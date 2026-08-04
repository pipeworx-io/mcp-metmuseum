# mcp-metmuseum

The Metropolitan Museum of Art Collection MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_artworks` | Search The Met's open-access collection by keyword. Optionally filter to objects with images, currently on view, by medium, or by a year range. Returns compact records (title, artist, date, medium, image) hydrated from object detail. Keyless. |
| `get_artwork` | Get the rich detail for a single Met collection object by its objectID — artist bio, medium, dimensions, department, classification, culture, period, credit line, image URLs, tags, and gallery number. Keyless. |
| `list_departments` | List The Met's curatorial departments (e.g. European Paintings, Egyptian Art, Arms and Armor) with their department IDs, usable to scope searches. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "metmuseum": {
      "url": "https://gateway.pipeworx.io/metmuseum/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Metmuseum data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
