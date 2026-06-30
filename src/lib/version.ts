// Fonte ÚNICA de verdade para o nome e a versão da app.
// A versão deriva do package.json — para lançar a 1.1 / 2.0 muda-se SÓ lá.
import pkg from "../../package.json";

/** Marca / nome técnico da app. */
export const APP_NAME = "AFROLOC";

/** Versão semântica (semver), ex.: "1.0.0". Vem do package.json. */
export const APP_VERSION = pkg.version;

const [major = "1", minor = "0"] = APP_VERSION.split(".");

/** Etiqueta curta de versão, ex.: "Ver 1.0". */
export const APP_VERSION_LABEL = `Ver ${major}.${minor}`;

/** Etiqueta completa para mostrar ao utilizador, ex.: "AFROLOC Ver 1.0". */
export const APP_FULL_LABEL = `${APP_NAME} ${APP_VERSION_LABEL}`;
