/* WEB-TO-DESKTOP NOTE: Public surface of @workspace/import.
 * Pure-TS, no Express/DOM coupling — usable from web API, CLI, or Electron main. */

export * from "./types.js";
export * from "./encoding.js";
export * from "./parse.js";
export * from "./normalize.js";
export * from "./mappers/fournisseur.js";
export * from "./mappers/client.js";
export * from "./mappers/produit.js";
