type Config = {
  spreadsheetId: string;
  reviewQueueSheetName: string;
  assetsSheetName: string;
  workflowRunsSheetName: string;
  trendInputSheetName: string;
  serviceAccountEmail: string;
  privateKey: string;
  openaiApiKey: string;
  driveAssetFolderId: string;
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
    workflowRunsSheetName: process.env.WORKFLOW_RUNS_SHEET_NAME ?? 'workflow_runs',
    trendInputSheetName: process.env.TRENDS_INPUT_SHEET_NAME ?? 'trends_input',
    serviceAccountEmail: required('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    privateKey: required('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    driveAssetFolderId: process.env.GOOGLE_DRIVE_ASSET_FOLDER_ID ?? '1-HqjaBbOnG2Qgn2iHzehRn1cuPC6io0G'
  };
}
