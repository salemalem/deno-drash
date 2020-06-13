import { green, red } from "./deps.ts";
const { args } = Deno;
const wantsHelp = (args.find((arg) => arg === "--help") !== undefined);
const wantsWebApp = (args.find((arg) => arg === "--web-app") !== undefined);
const wantsApi = (args.find((arg) => arg === "--api") !== undefined);
const wantsVue = (args.find((arg) => arg === "--with-vue") !== undefined);
const cwd = Deno.realPathSync(".");
// strip this file name from the path and add the link to the boilerplate dir
const pathToScriptRoot = import.meta.url.slice(0, -13); // Remove this script name: ".../deno-drash/"
const boilerPlateDir = Deno.build.os === "windows"
  ? pathToScriptRoot.substring(8) + "console/create_app" // Remove characters that would error, for example, removing "file:///" for windows
  : pathToScriptRoot.substring(5) + "console/create_app";
const notesForUser: string[] = [];

//////////////////////////////////////////////////////////////////////////////
// FILE MARKER - FUNCTIONS ///////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

/**
 * Responsible for showing the help message when a user uses `--help`
 */
function showHelp() {
  const helpMessage = "\n" +
    "A create app script for Drash" +
    "\n" +
    "\n" +
    "USAGE:" +
    "\n" +
    "    deno run --allow-read --allow-run create_app.ts [OPTIONS]" +
    "\n" +
    "    deno run --allow-read --allow-run https://deno.land/x/drash/create_app.ts [OPTIONS]" +
    "\n" +
    "\n" +
    "OPTIONS:" +
    "\n" +
    "The --api and --web-app options cannot be used together." +
    "\n" +
    "\n" +
    "    --api" +
    "\n" +
    "        Creates the file structure and content for a Drash API." +
    "\n" +
    "\n" +
    "    --web-app" +
    "\n" +
    "        Creates the file structure and content for a Drash Web App." +
    "\n" +
    "\n" +
    "    --web-app --with-vue" +
    "\n" +
    "        Creates the file structure and content for a Drash Web App." +
    "\n" +
    "        This options requires Node and npm because it uses Vue and webpack." +
    "\n" +
    "\n" +
    "EXAMPLE USAGE:" +
    "\n" +
    "    mkdir my-drash-api" +
    "\n" +
    "    cd my-drash-api" +
    "\n" +
    "    deno run --allow-read --allow-run --allow-write https://deno.land/x/drash/create_app.ts --api" +
    "\n";
  console.info(helpMessage);
}

/**
 * On writing to and creating files, we send a message to stdout to let the user know something
 * is happening
 *
 * @param {string} message Message to show in the console. Required.
 */
function writeFileWrittenOrCreatedMessage(message: string) {
  console.info(green(message));
}

/**
 * Send our thank you message for using it
 */
function sendThankYouMessage() {
  notesForUser.push(
    "To run your application:",
    "    deno run --allow-net --allow-read app.ts",
  );
  const whatUserWanted = wantsApi
    ? "Your Drash API project "
    : wantsWebApp && !wantsVue
    ? "Your Drash web app project "
    : wantsWebApp && wantsVue
    ? "Your Drash web app project with Vue "
    : "";
  console.info(
    whatUserWanted + "has been created.\n" +
      "Thank you for using Drash's create app script, we hope you enjoy your newly built project!\n" +
      notesForUser.join("\n"),
  );
}

function buildTheBaseline() {
  Deno.copyFileSync(`${boilerPlateDir}/deps.ts`, cwd + "/deps.ts");
  Deno.copyFileSync(`${boilerPlateDir}/config.ts`, cwd + "/config.ts");
  Deno.mkdirSync(cwd + "/middleware");
  Deno.mkdirSync(cwd + "/tests/resources", { recursive: true });
  Deno.copyFileSync(
    `${boilerPlateDir}/tests/resources/home_resource_test.ts`,
    cwd + "/tests/resources/home_resource_test.ts",
  );
}

/**
 * Responsible for all the logic around creating a web app
 */
function buildForWebApp() {
  Deno.copyFileSync(`${boilerPlateDir}/app_web_app.ts`, cwd + "/app.ts");
  Deno.mkdirSync(cwd + "/public/views", { recursive: true });
  Deno.mkdirSync(cwd + "/public/css", { recursive: true });
  Deno.mkdirSync(cwd + "/public/js", { recursive: true });
  Deno.mkdirSync(cwd + "/public/img", { recursive: true });
  Deno.mkdirSync(cwd + "/resources");
  Deno.copyFileSync(
    `${boilerPlateDir}/resources/home_resource.ts`,
    cwd + "/resources/home_resource.ts",
  );

  if (wantsVue) {
    Deno.copyFileSync(
      `${boilerPlateDir}/package_vue.json`,
      cwd + "/package.json",
    );
    Deno.copyFileSync(
      `${boilerPlateDir}/webpack_vue.config.js`,
      cwd + "/webpack.config.js",
    );
    Deno.mkdirSync(cwd + "/vue");
    Deno.copyFileSync(`${boilerPlateDir}/vue/app.js`, cwd + "/vue/app.js");
    Deno.copyFileSync(`${boilerPlateDir}/vue/app.vue`, cwd + "/vue/App.vue");
    Deno.copyFileSync(
      `${boilerPlateDir}/public/views/index_vue.html`,
      cwd + "/public/views/index.html",
    );
    notesForUser.push("Install NPM dependencies:\n    npm install");
    notesForUser.push(
      "Build your Vue component with Webpack:\n    npm run buildVue",
    );
  } else {
    Deno.copyFileSync(
      `${boilerPlateDir}/public/views/index.html`,
      cwd + "/public/views/index.html",
    );
    Deno.copyFileSync(
      `${boilerPlateDir}/public/css/index.css`,
      cwd + "/public/css/index.css",
    );
    Deno.copyFileSync(
      `${boilerPlateDir}/public/js/index.js`,
      cwd + "/public/js/index.js",
    );
  }
}

/**
 * Responsible for all the logic around creating an api - eg omits views, js files
 */
function buildForAPI() {
  Deno.copyFileSync(`${boilerPlateDir}/app_api.ts`, cwd + "/app.ts");
  Deno.mkdirSync(cwd + "/resources");
  Deno.copyFileSync(
    `${boilerPlateDir}/resources/home_resource_api.ts`,
    cwd + "/resources/home_resource.ts",
  );
}

//////////////////////////////////////////////////////////////////////////////
// FILE MARKER - ENTRY POINT LOGIC ///////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// Requirement: Now allowed to ask for an API AND Web App
if (wantsApi && wantsWebApp) {
  console.error(
    red(
      "--web-app and --api options are now allowed to be used together. Use the --help option for more information.",
    ),
  );
  Deno.exit(1);
}

// Requirement: One main argument is required
const tooFewArgs = !wantsHelp && !wantsWebApp && !wantsApi;
if (tooFewArgs) {
  console.error(
    red(
      "Too few options were given. Use the --help option for more information.",
    ),
  );
  Deno.exit(1);
}

// Requirement: Add a --help option
if (wantsHelp) {
  showHelp();
  Deno.exit();
}

// Requirement: Add support for building a Drash API (--api)
if (wantsApi) {
  buildTheBaseline();
  buildForAPI();
  sendThankYouMessage();
  Deno.exit();
}

// Requirement: Add support for building a web app (--web-app [--with-vue])
if (wantsWebApp) {
  buildTheBaseline();
  buildForWebApp();
  sendThankYouMessage();
  Deno.exit();
}
