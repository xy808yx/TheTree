// The shared app-state object and a tiny read accessor. Lives in its own module
// so views can read the current context without importing main.js — which would
// create an import cycle (main → views → main) and break the single-file bundler,
// whose blob-module loader needs an acyclic graph. main.js owns and mutates
// `app`; everyone else only reads it through context().

export const app = { mode: null, file: null, archiveName: '', focus: null, dirty: false };

// A read-only snapshot for views. `file` is the saved family.html handle (or null
// in demo / unsaved-standalone); `mode` is 'archive' | 'demo' | null.
export function context() { return { mode: app.mode, file: app.file }; }
