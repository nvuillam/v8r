"use strict";

const Ajv = require("ajv");
const fs = require("fs");
const got = require("got");
const path = require("path");
const yaml = require("js-yaml");

async function fetch(url) {
  try {
    const resp = await got(url);
    return JSON.parse(resp.body);
  } catch (error) {
    if (error.response) {
      throw new Error(`❌ Failed fetching ${url}\n${error.response.body}`);
    }
    throw new Error(`❌ Failed fetching ${url}`);
  }
}

async function getSchemaUrlForFilename(filename) {
  const { schemas } = await fetch(
    "https://www.schemastore.org/api/json/catalog.json"
  );
  const matches = [];
  schemas.forEach(function (schema) {
    if ("fileMatch" in schema && schema.fileMatch.includes(filename)) {
      matches.push(schema);
    }
  });
  if (matches.length == 1) {
    return matches[0].url;
  }
  throw new Error(`❌ Could not find a schema to validate ${filename}`);
}

async function validate(data, schema) {
  const ajv = new Ajv({ schemaId: "auto", loadSchema: fetch });
  ajv.addMetaSchema(require("ajv/lib/refs/json-schema-draft-04.json"));
  ajv.addMetaSchema(require("ajv/lib/refs/json-schema-draft-06.json"));
  const validate = await ajv.compileAsync(schema);
  const valid = validate(data);
  if (!valid) {
    console.log("\nErrors:");
    console.log(validate.errors);
    console.log("");
  }
  return valid;
}

function parseFile(contents, format) {
  switch (format) {
    case ".json":
    case ".geojson":
    case ".jsonld":
      return JSON.parse(contents);
    case ".yml":
    case ".yaml":
      return yaml.safeLoad(contents);
    default:
      throw new Error(`❌ Unsupported format ${format}`);
  }
}

async function cli(args) {
  const filename = args.filename;

  const data = parseFile(
    fs.readFileSync(filename, "utf8").toString(),
    path.extname(filename)
  );
  const schemaUrl =
    args.schema || (await getSchemaUrlForFilename(path.basename(filename)));
  const schema = await fetch(schemaUrl);
  console.log(`Validating ${filename} against schema from ${schemaUrl} ...`);

  const valid = await validate(data, schema);
  if (valid) {
    console.log(`✅ ${filename} is valid`);
  } else {
    console.log(`❌ ${filename} is invalid`);
  }
  return valid;
}

module.exports = { cli };
