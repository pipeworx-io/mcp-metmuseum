interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * The Metropolitan Museum of Art Collection MCP.
 *
 * Open-access metadata and images for The Met's collection — 470,000+ artworks
 * spanning 5,000 years. Search by keyword (optionally filtered to objects with
 * images, on view, by medium, or date range), fetch rich per-object detail, and
 * list curatorial departments. Keyless.
 */


const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_artworks',
    description:
      "Search The Met's open-access collection by keyword. Optionally filter to objects with images, currently on view, by medium, or by a year range. Returns compact records (title, artist, date, medium, image) hydrated from object detail. Keyless.",
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query, e.g. "sunflowers", "Vermeer", "samurai armor".' },
        limit: {
          type: 'number',
          description: 'How many matching objects to hydrate with full detail (default 8, max 15).',
        },
        has_images: {
          type: 'boolean',
          description: 'Only return objects that have images (default true).',
        },
        on_view: {
          type: 'boolean',
          description: 'Only return objects currently on view in a gallery.',
        },
        date_begin: {
          type: 'number',
          description: 'Start year of the date range, e.g. 1700. Must be paired with date_end.',
        },
        date_end: {
          type: 'number',
          description: 'End year of the date range, e.g. 1800. Must be paired with date_begin.',
        },
      },
      required: ['q'],
    },
  },
  {
    name: 'get_artwork',
    description:
      "Get the rich detail for a single Met collection object by its objectID — artist bio, medium, dimensions, department, classification, culture, period, credit line, image URLs, tags, and gallery number. Keyless.",
    inputSchema: {
      type: 'object',
      properties: {
        object_id: { type: 'number', description: 'The Met objectID, e.g. 436535.' },
      },
      required: ['object_id'],
    },
  },
  {
    name: 'list_departments',
    description:
      "List The Met's curatorial departments (e.g. European Paintings, Egyptian Art, Arms and Armor) with their department IDs, usable to scope searches. Keyless.",
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_artworks':
        return searchArtworks(args);
      case 'get_artwork':
        return getArtwork(args);
      case 'list_departments':
        return listDepartments();
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchObject(id: number): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}/objects/${id}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

function toCompact(o: Record<string, unknown>): Record<string, unknown> {
  return {
    objectID: o.objectID,
    title: o.title,
    artist: o.artistDisplayName,
    date: o.objectDate,
    medium: o.medium,
    department: o.department,
    culture: o.culture,
    isHighlight: o.isHighlight,
    isPublicDomain: o.isPublicDomain,
    primaryImageSmall: o.primaryImageSmall,
    objectURL: o.objectURL,
  };
}

async function searchArtworks(args: Record<string, unknown>): Promise<unknown> {
  const q = typeof args.q === 'string' ? args.q.trim() : '';
  if (!q) return { error: 'provide a search query', q: args.q ?? null };

  let limit = typeof args.limit === 'number' ? Math.floor(args.limit) : 8;
  if (!Number.isFinite(limit) || limit < 1) limit = 8;
  if (limit > 15) limit = 15;

  const hasImages = args.has_images === undefined ? true : args.has_images === true;
  const params = new URLSearchParams({ q });
  if (hasImages) params.set('hasImages', 'true');
  if (args.on_view === true) params.set('isOnView', 'true');
  if (typeof args.medium === 'string' && args.medium.trim()) params.set('medium', args.medium.trim());

  const dateBegin = typeof args.date_begin === 'number' ? args.date_begin : undefined;
  const dateEnd = typeof args.date_end === 'number' ? args.date_end : undefined;
  if (dateBegin !== undefined || dateEnd !== undefined) {
    params.set('dateBegin', String(dateBegin ?? dateEnd));
    params.set('dateEnd', String(dateEnd ?? dateBegin));
  }

  const res = await fetch(`${BASE}/search?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) return { error: `met: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const data = (await res.json()) as Record<string, unknown>;
  const total = typeof data.total === 'number' ? data.total : 0;
  const objectIDs = Array.isArray(data.objectIDs) ? (data.objectIDs as number[]) : null;
  if (!objectIDs || objectIDs.length === 0) {
    return { total, shown: 0, artworks: [] };
  }

  const ids = objectIDs.slice(0, limit);
  const artworks: Record<string, unknown>[] = [];
  for (const id of ids) {
    const o = await fetchObject(id);
    if (o) artworks.push(toCompact(o));
  }

  return { total, shown: artworks.length, artworks };
}

async function getArtwork(args: Record<string, unknown>): Promise<unknown> {
  const objectId = typeof args.object_id === 'number' ? Math.floor(args.object_id) : NaN;
  if (!Number.isFinite(objectId)) return { error: 'provide a numeric object_id', object_id: args.object_id ?? null };

  const res = await fetch(`${BASE}/objects/${objectId}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404) return { error: 'object not found', object_id: objectId };
  if (!res.ok) return { error: `met: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const o = (await res.json()) as Record<string, unknown>;
  const additional = Array.isArray(o.additionalImages) ? (o.additionalImages as string[]) : [];
  const tagsRaw = Array.isArray(o.tags) ? (o.tags as Array<Record<string, unknown>>) : null;

  return {
    objectID: o.objectID,
    title: o.title,
    artistDisplayName: o.artistDisplayName,
    artistDisplayBio: o.artistDisplayBio,
    artistNationality: o.artistNationality,
    objectDate: o.objectDate,
    objectBeginDate: o.objectBeginDate,
    objectEndDate: o.objectEndDate,
    medium: o.medium,
    dimensions: o.dimensions,
    department: o.department,
    classification: o.classification,
    culture: o.culture,
    period: o.period,
    dynasty: o.dynasty,
    creditLine: o.creditLine,
    geographyType: o.geographyType,
    country: o.country,
    isHighlight: o.isHighlight,
    isPublicDomain: o.isPublicDomain,
    primaryImage: o.primaryImage,
    primaryImageSmall: o.primaryImageSmall,
    additionalImages: { count: additional.length, urls: additional.slice(0, 3) },
    objectURL: o.objectURL,
    tags: tagsRaw ? tagsRaw.slice(0, 10).map((t) => t.term) : null,
    GalleryNumber: o.GalleryNumber,
  };
}

async function listDepartments(): Promise<unknown> {
  const res = await fetch(`${BASE}/departments`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) return { error: `met: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const data = (await res.json()) as Record<string, unknown>;
  const list = Array.isArray(data.departments) ? (data.departments as Array<Record<string, unknown>>) : [];
  return {
    count: list.length,
    departments: list.map((d) => ({
      departmentId: d.departmentId,
      displayName: d.displayName,
    })),
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
