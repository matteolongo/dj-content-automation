import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { Readable as NodeReadable } from 'node:stream';
import { createGoogleAuthClient } from '@/lib/google';

export const runtime = 'nodejs';

function asStatus(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const maybeResponse = (error as { response?: { status?: number } }).response;
    if (typeof maybeResponse?.status === 'number') {
      return maybeResponse.status;
    }

    const maybeCode = (error as { code?: number }).code;
    if (typeof maybeCode === 'number') {
      return maybeCode;
    }
  }

  return 500;
}

function safeFileName(fileName: string) {
  return fileName.replace(/["\\]/g, '_');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId: rawAssetId } = await params;
  const assetId = decodeURIComponent(rawAssetId || '').trim();

  if (!assetId) {
    return NextResponse.json({ error: 'Missing asset id' }, { status: 400 });
  }

  try {
    const auth = createGoogleAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    const metadataResponse = await drive.files.get({
      fileId: assetId,
      fields: 'id,name,mimeType'
    });

    const downloadResponse = await drive.files.get(
      {
        fileId: assetId,
        alt: 'media'
      },
      {
        responseType: 'stream'
      }
    );

    const mimeType = metadataResponse.data.mimeType || 'application/octet-stream';
    const fileName = metadataResponse.data.name;
    const headers = new Headers({
      'Cache-Control': 'private, max-age=300',
      'Content-Type': mimeType,
      'X-Content-Type-Options': 'nosniff'
    });

    if (fileName) {
      headers.set('Content-Disposition', `inline; filename="${safeFileName(fileName)}"`);
    }

    const body = NodeReadable.toWeb(downloadResponse.data as unknown as NodeReadable) as any;

    return new Response(body, {
      status: 200,
      headers
    });
  } catch (error) {
    const status = asStatus(error);
    const message =
      status === 404
        ? 'Asset not found'
        : status === 403
          ? 'Asset is not accessible'
          : 'Failed to fetch asset';

    return NextResponse.json({ error: message }, { status });
  }
}
