type Config = {
  spreadsheetId: string;
  reviewQueueSheetName: string;
  assetsSheetName: string;
  serviceAccountEmail: string;
  privateKey: string;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getConfig(): Config {
  return {
    spreadsheetId: required('GOOGLE_SHEET_ID'),
    reviewQueueSheetName: process.env.REVIEW_QUEUE_SHEET_NAME ?? 'review_queue',
    assetsSheetName: process.env.ASSETS_SHEET_NAME ?? 'assets',
    serviceAccountEmail: required('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    privateKey: required('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n')
  };
}
