// Allow side-effect CSS imports (e.g. `import "./globals.css"`) under our
// "moduleResolution": "bundler" setup. Without this, the editor flags the
// import as having no type declaration — and an autofix may strip it, which
// would silently break Tailwind. Next.js handles the actual CSS at build time.
declare module "*.css";
