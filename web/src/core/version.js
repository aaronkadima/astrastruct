export const PRODUCT_VERSION = '0.47.0';
export const PROJECT_SCHEMA_VERSION = 2;
export const RESULT_CONTRACT_VERSION = '1.0';
export function productMetadata(existing = {}) {return {...existing,productVersion:PRODUCT_VERSION,schemaVersion:PROJECT_SCHEMA_VERSION};}
