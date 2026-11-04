// Vite bundles plain CSS side-effect imports. Until the app shell adds
// vite/client types (task #6), declare them so `npm run check` passes.
declare module '*.css';
