// Reexport the native module. On web, it will be resolved to BugsplatExpoModule.web.ts
// and on native platforms to BugsplatExpoModule.ts
export { default } from './BugsplatExpoModule';
export { default as BugsplatExpoView } from './BugsplatExpoView';
export * from  './BugsplatExpo.types';
