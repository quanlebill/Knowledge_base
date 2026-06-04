local typedefs = require "kong.db.schema.typedefs"

return {
  name = "aeroflow-jwks",
  fields = {
    { protocols = typedefs.protocols_http },
    { config = {
      type = "record",
      fields = {
        { jwks_uri              = typedefs.url({ required = true })            },
        { issuer                = { type = "string",  required = false }       },
        { audience              = { type = "string",  required = false }       },
        { jwks_refresh_interval = { type = "number",  default = 300  }        },
        { hide_credentials      = { type = "boolean", default = true  }       },
      },
    }},
  },
}
