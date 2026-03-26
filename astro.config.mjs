// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// GitHub Pages project sites require a repo-name prefix, e.g. /my-repo/.
	// In CI we will set BASE_URL accordingly.
	base: process.env.BASE_URL ?? "/",
});
