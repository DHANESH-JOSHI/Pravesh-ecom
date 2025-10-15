import moduleAlias from "module-alias";
import path from "path";
import config from ".";

const basePath = config.NODE_ENV === "production" ? "dist/app" : "src/app";
moduleAlias.addAliases({
    "@": path.join(process.cwd(), basePath),
});