/**
 * The demo imports stylesheets for their side effect. TypeScript 7 wants a
 * declaration for those; the bundler is what actually resolves them.
 */
declare module "*.css";
