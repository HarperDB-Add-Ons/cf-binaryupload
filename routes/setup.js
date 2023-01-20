export default async (server, { hdbCore, logger }) => {
    server.route({
        url: '/setup',
        method: 'GET',
        handler: async (request) => {
            const results = {};

            request.body = {
                operation: 'create_schema',
                schema: 'dev',
            };

            try {
                results.schema_result = await hdbCore.requestWithoutAuthentication(request);
            } catch (e) {
                results.schema_result = e;
            }

            request.body = {
                operation: 'create_table',
                schema: 'dev',
                table: 'dog',
                hash_attribute: 'id',
            };

            try {
                results.cache_table_result = await hdbCore.requestWithoutAuthentication(request);
            } catch (e) {
                results.cache_table_result = e;
            }

            await new Promise((resolve) => setTimeout(resolve, 100));

            request.body = {
                operation: 'create_attribute',
                schema: 'dev',
                table: 'dog',
                attribute: 'dog_name',
            };

            try {
                results.cache_table_attribute_error_result = await hdbCore.requestWithoutAuthentication(request);
            } catch (e) {
                results.cache_table_attribute_error_result = e;
            }

            await new Promise((resolve) => setTimeout(resolve, 100));

            return results;
        },
    });
};