export {
  IFC_INTEROP_CONTRACT,IFC_INTEROP_VERSION,IFC_SCHEMA,IFC_STANDARD,
  ifcClassForElement,createIfcInteroperabilityModel,validateIfcInteroperabilityModel,
  renderIfcInteroperabilityJson,parseIfcInteroperabilityJson,restoreStructuralCoreFromIfcModel,summarizeIfcInteroperability
} from './ifc.js';
export {
  IFC_GUID_ALPHABET,validateIfcGuid,compressIfcGuid,expandIfcGuid,newIfcGuid,
  createIfcIdentityMap,assignIfcGlobalIds,validateIfcGlobalIds
} from './ifcGuid.js';
