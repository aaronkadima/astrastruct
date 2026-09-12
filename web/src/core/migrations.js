import { analysisConfigFromSettings, settingsFromAnalysisConfig } from './analysisConfig.js';
import { PRODUCT_VERSION, PROJECT_SCHEMA_VERSION, productMetadata } from './version.js';

const clone = value => JSON.parse(JSON.stringify(value ?? {}));

function migrateV1ToV2(project) {
  const next = { ...project };
  next.settings = settingsFromAnalysisConfig(next.analysis || {}, next.settings || {});
  next.analysis = analysisConfigFromSettings(next.settings);
  next.schemaVersion = 2;
  next.meta = productMetadata({
    ...(next.meta || {}),
    migrations: [...(next.meta?.migrations || []), 'project-schema-v1-to-v2'],
  });
  return next;
}

export function migrateProject(input = {}) {
  let project = clone(input);
  let schemaVersion = Number(project.schemaVersion || 1);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) schemaVersion = 1;
  if (schemaVersion > PROJECT_SCHEMA_VERSION) {
    throw new Error(`Projeto usa schema ${schemaVersion}, superior ao suportado (${PROJECT_SCHEMA_VERSION}) pelo AstraStruct ${PRODUCT_VERSION}.`);
  }
  while (schemaVersion < PROJECT_SCHEMA_VERSION) {
    if (schemaVersion === 1) project = migrateV1ToV2(project);
    else throw new Error(`Migração de schema não implementada: ${schemaVersion} → ${schemaVersion + 1}.`);
    schemaVersion = Number(project.schemaVersion);
  }
  project.schemaVersion = PROJECT_SCHEMA_VERSION;
  project.meta = productMetadata(project.meta || {});
  return project;
}
