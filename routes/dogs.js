import pov from "@fastify/view";
import multipart from "@fastify/multipart";
import formbody from "@fastify/formbody";
import cookie from "@fastify/cookie";
import staticPlugin from "@fastify/static";
import ejs from "ejs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import * as url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export default async (server, { hdbCore, logger }) => {
  // GET, WITH NO preValidation AND USING hdbCore.requestWithoutAuthentication
  // BYPASSES ALL CHECKS: DO NOT USE RAW USER-SUBMITTED VALUES IN SQL STATEMENTS
  /*
    Register Fastify Plugins
  */
  server.register(pov, {
    engine: { ejs },
    root: path.dirname(require.resolve("../templates/dog.ejs")),
  });
  server.register(multipart);
  server.register(formbody);
  server.register(cookie);
  // TEMPORARY (maybe?) add a static route for the index and login
  server.register(staticPlugin, {
    root: path.join(__dirname, "..", "static"),
  });
  /*
    Authentication Validation
   */
  const checkAuth = (req, resp, done) => {
    req.body = {};
    req.headers.authorization = "Bearer " + req.cookies.auth; // 'Basic a3p5cDpsYWNraW5n';
    try {
      // try a request
      hdbCore.preValidation[1](req, resp, (error) => {
        if (error)
            // return a redirect to the login upon error
          return resp
              .code(302)
              .header("Location", "login.html")
              .send("no dogs for you!");
        // callback if successful
        done();
      });
    } catch (error) {
      console.error(error);
      resp.code(302).header("Location", "login.html");
    }
  };

  /*
    GET /dogs
    the primary entry point, where the UI exists
  */
  server.get("/dogs", {
    preValidation: checkAuth,
    handler: async (request, reply) => {
      request.body = {
        operation: "sql",
        sql: "SELECT * FROM dev.dog ORDER BY dog_name",
      };
      let dogs = await hdbCore.requestWithoutAuthentication(request);
      return reply.view("dogs.ejs", { dogs });
    },
  });

  /*
    GET /dog/:id
    returns a dog record
  */
  server.get("/dog/:id", {
    preValidation: checkAuth,
    handler: async (request, reply) => {
      request.body = {
        operation: "search_by_hash",
        schema: "dev",
        table: "dog",
        hash_values: [+request.params.id],
        get_attributes: ["*"],
      };
      let response = await hdbCore.requestWithoutAuthentication(request);

      let [dog] = response
      return reply.view("dog.ejs", { dog });
    },
  });

  /*
    POST /dog/:id
    creates a dog record, including image/binary upload
  */
  server.post("/dog/:id", {
    preValidation: checkAuth,
    handler: async (request, reply) => {
      request.body = {
        operation: "search_by_hash",
        schema: "dev",
        table: "dog",
        hash_values: [+request.params.id],
        get_attributes: ["*"],
      };
      let [dog] = await hdbCore.requestWithoutAuthentication(request);
      dog = Object.assign({}, dog); // copy it
      // get the uploaded image
      const form_data = await request.file();
      const image_buffer = await form_data.toBuffer();
      if (image_buffer.length > 0) {
        dog.imageType = form_data.mimetype;
        dog.image = image_buffer;
      }
      dog.weight_lbs = +form_data.fields.weight.value;
      request.body = {
        operation: "update",
        schema: "dev",
        table: "dog",
        records: [dog],
      };

      let result = await hdbCore.requestWithoutAuthentication(request);
      reply
          .code(303)
          .header("Location", request.params.id)
          .send(result);
    },
  });

  /*
    GET /dog/:id/image
    returns the binary image data
  */
  server.get("/dog/:id/image", {
    preValidation: checkAuth,
    handler: async (request, reply) => {
      request.body = {
        operation: "search_by_hash",
        schema: "dev",
        table: "dog",
        hash_values: [+request.params.id],
        get_attributes: ["image", "imageType"],
      };
      let [dog] = await hdbCore.requestWithoutAuthentication(request);
      reply.code(200).header("Content-Type", dog.imageType).send(Buffer.from(dog.image));
    },
  });

  /*
    POST /login
    creates and auth cookie with the provided credentials
    redirects to the /dogs UI
  */
  server.post("/login", async (request, reply) => {
    request.body = Object.assign(request.body, {
      operation: "create_authentication_tokens",
    });
    let result = await hdbCore.request(request);
    reply
        .setCookie("auth", result.operation_token)
        .code(303)
        .header("Location", "dogs")
        .send(result);
  });
};