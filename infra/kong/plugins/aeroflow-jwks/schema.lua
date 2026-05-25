local typedefs = require "kong.db.schema.typedefs"

return {
  name = "aeroflow-jwks",
  fields = {
    { protocols = typedefs.protocols_http },
    { config = {
      type = "record",
      fields = {
        { jwks_uri            = { type = "string",  required = true  } },
        { issuer              = { type = "string",  required = false } },
        { jwks_refresh_interval = { type = "number", default = 300  } },
      },
    }},
  },
}
