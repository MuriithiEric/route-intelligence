const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const SUPABASE_URL = 'https://atojbdohhvmjgtyagtkr.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0b2piZG9oaHZtamd0eWFndGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDE1NjQsImV4cCI6MjA5MTc3NzU2NH0.3A9NdeiE7A4oiLSmHTab_Xabap8K9kZ6NlN42-3KpKg';

async function sbFetch(table, filters) {
  const params = new URLSearchParams();
  for (const [k, v] of filters) params.append(k, v);
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`DB ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

const TOOLS = [
  {
    name: 'query_rep_performance',
    description:
      'Get trailing twelve month (TTM) performance summary for one or all field reps. ' +
      'Returns: name (display), raw_name (use this in other query tools), role, total_visits, unique_shops, ' +
      'unique_routes, primary_region, regions_covered, avg_duration (minutes per visit), coverage_pct, ' +
      'field_days, visits_per_day, last_active, rep_status. ' +
      'Use raw_name in query_visits, query_daily_activity, and query_visit_frequency for accurate filtering.',
    input_schema: {
      type: 'object',
      properties: {
        rep_name: {
          type: 'string',
          description: 'Partial rep name match (case-insensitive). Omit to return all reps.',
        },
        sort_by: {
          type: 'string',
          enum: ['total_visits', 'unique_shops', 'coverage_pct', 'visits_per_day', 'field_days', 'avg_duration'],
          description: 'Sort column. Default: total_visits.',
        },
        limit: { type: 'number', description: 'Max rows. Default: 100.' },
      },
    },
  },
  {
    name: 'query_visits',
    description:
      'Query individual visit records from the database. One row = one rep check-in at one outlet. ' +
      'Columns: shop_id, shop_name, rep_name, category (sales channel/group), region, route_name, ' +
      'check_in (ISO datetime), check_out (ISO datetime), duration (minutes). ' +
      'Use to answer questions about specific visits, dates a rep worked, customers visited, ' +
      'visit duration, or regional activity. Filter by any combination of rep, date, region, shop, or route.',
    input_schema: {
      type: 'object',
      properties: {
        rep_name: {
          type: 'string',
          description: 'Partial rep name match. Use raw_name from query_rep_performance for precision.',
        },
        shop_name: { type: 'string', description: 'Partial customer/outlet name match.' },
        region: {
          type: 'string',
          description: 'Partial region match. Regions: NAIROBI, NORTH RIFT, SOUTH RIFT, CENTRAL, LAKE, COAST, NYANZA, OTHER.',
        },
        route_name: { type: 'string', description: 'Partial route name match.' },
        date_from: { type: 'string', description: 'Start date inclusive, format YYYY-MM-DD.' },
        date_to: { type: 'string', description: 'End date inclusive, format YYYY-MM-DD.' },
        order: { type: 'string', enum: ['newest', 'oldest'], description: 'Date sort order. Default: newest.' },
        limit: { type: 'number', description: 'Max rows. Default: 50. Use up to 200 for broad queries.' },
      },
    },
  },
  {
    name: 'query_customers',
    description:
      'Look up customer (outlet) records from the customers table. ' +
      'Columns: id, name, cat (DB category), tier, region, territory, last_visit, last_sale, phone. ' +
      'DB categories: DISTRIBUTOR (157 BIDCO distributors), KEY ACCOUNT, HUB, STOCKIST, ' +
      'SUPERMARKET (shown as "Modern Trade" in UI), DISTRIBUTOR - FEEDS (946 agricultural feeds distributors — NOT BIDCO). ' +
      'Note: last_visit comes from field ops check-ins; last_sale comes from ERP. ' +
      'A customer can have a recent sale but old last_visit (e.g. phone/agent orders).',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Partial outlet/customer name match.' },
        cat: {
          type: 'string',
          enum: ['DISTRIBUTOR', 'KEY ACCOUNT', 'HUB', 'STOCKIST', 'SUPERMARKET', 'DISTRIBUTOR - FEEDS'],
          description: 'Category filter. Modern Trade = SUPERMARKET in the database.',
        },
        region: { type: 'string', description: 'Partial region match.' },
        territory: { type: 'string', description: 'Partial territory match.' },
        limit: { type: 'number', description: 'Max rows. Default: 50.' },
      },
    },
  },
  {
    name: 'query_daily_activity',
    description:
      'Get day-by-day field activity for a specific rep. ' +
      'Columns: rep_name, category (sales group), date, day_start, day_end, visits_that_day, shops_that_day. ' +
      'Use to analyse work patterns, consistency, days worked, or activity on specific dates. ' +
      'Always use the exact raw_name from query_rep_performance.',
    input_schema: {
      type: 'object',
      properties: {
        rep_name: {
          type: 'string',
          description: 'Rep name — use exact raw_name from query_rep_performance for accurate results.',
        },
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD.' },
        date_to: { type: 'string', description: 'End date YYYY-MM-DD.' },
        limit: { type: 'number', description: 'Max rows. Default: 90 (approx 3 months of field days).' },
      },
      required: ['rep_name'],
    },
  },
  {
    name: 'query_routes',
    description:
      'Get route-level performance data. ' +
      'Columns: route_id, route_name, rep_name, category, visits, shops, primary_region. ' +
      'Use to compare routes, identify high/low performing routes, or see which routes a rep covers.',
    input_schema: {
      type: 'object',
      properties: {
        rep_name: { type: 'string', description: 'Partial rep name filter.' },
        region: { type: 'string', description: 'Partial region filter.' },
        limit: { type: 'number', description: 'Max rows. Default: 50.' },
      },
    },
  },
  {
    name: 'query_visit_frequency',
    description:
      'Get per-customer visit frequency for a rep — how many times a rep visited each shop. ' +
      'Columns: rep_name, shop_id, visit_count, first_visit, last_visit. ' +
      'Use to identify over/under-visited customers, check visit cadence, or find neglected outlets. ' +
      'Combine with query_customers (by shop name) to get customer details.',
    input_schema: {
      type: 'object',
      properties: {
        rep_name: {
          type: 'string',
          description: 'Rep name — use exact raw_name from query_rep_performance.',
        },
        min_visits: { type: 'number', description: 'Only shops visited at least N times.' },
        max_visits: { type: 'number', description: 'Only shops visited at most N times (use 1 for one-time visits).' },
        limit: { type: 'number', description: 'Max rows. Default: 50.' },
      },
      required: ['rep_name'],
    },
  },
  {
    name: 'query_region_breakdown',
    description:
      'Get performance data broken down by sales channel (user group) and region. ' +
      'Columns: category, region, visits, unique_shops, unique_reps, coverage_pct. ' +
      'User groups: GT ATMs, TTMS, BIDCO RTM, BIDCO VAN SALES, ZAYN VAN SALES, RHOD, SUNTORY RTM, MT ATMS, MT TTMS, MT RHOD.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Sales channel / user group partial match.' },
        region: { type: 'string', description: 'Region partial match.' },
      },
    },
  },
];

async function executeToolCall(name, input) {
  try {
    if (name === 'query_rep_performance') {
      const f = [
        ['select', '*'],
        ['order', `${input.sort_by || 'total_visits'}.desc`],
        ['limit', String(input.limit || 100)],
      ];
      if (input.rep_name) f.push(['name', `ilike.*${input.rep_name}*`]);
      return await sbFetch('ttm_summary', f);
    }

    if (name === 'query_visits') {
      const f = [
        ['select', 'shop_id,shop_name,rep_name,category,region,route_name,check_in,check_out,duration'],
        ['order', input.order === 'oldest' ? 'check_in.asc' : 'check_in.desc'],
        ['limit', String(input.limit || 50)],
      ];
      if (input.rep_name) f.push(['rep_name', `ilike.*${input.rep_name}*`]);
      if (input.shop_name) f.push(['shop_name', `ilike.*${input.shop_name}*`]);
      if (input.region) f.push(['region', `ilike.*${input.region}*`]);
      if (input.route_name) f.push(['route_name', `ilike.*${input.route_name}*`]);
      if (input.date_from) f.push(['check_in', `gte.${input.date_from}`]);
      if (input.date_to) f.push(['check_in', `lte.${input.date_to}T23:59:59`]);
      return await sbFetch('visits', f);
    }

    if (name === 'query_customers') {
      const f = [
        ['select', 'id,name,cat,tier,region,territory,last_visit,last_sale,phone'],
        ['order', 'name.asc'],
        ['limit', String(input.limit || 50)],
      ];
      if (input.name) f.push(['name', `ilike.*${input.name}*`]);
      if (input.cat) f.push(['cat', `eq.${input.cat}`]);
      if (input.region) f.push(['region', `ilike.*${input.region}*`]);
      if (input.territory) f.push(['territory', `ilike.*${input.territory}*`]);
      return await sbFetch('customers', f);
    }

    if (name === 'query_daily_activity') {
      const f = [
        ['select', '*'],
        ['order', 'date.desc'],
        ['limit', String(input.limit || 90)],
      ];
      f.push(['rep_name', `ilike.*${input.rep_name}*`]);
      if (input.date_from) f.push(['date', `gte.${input.date_from}`]);
      if (input.date_to) f.push(['date', `lte.${input.date_to}`]);
      return await sbFetch('daily_activity', f);
    }

    if (name === 'query_routes') {
      const f = [
        ['select', '*'],
        ['order', 'visits.desc'],
        ['limit', String(input.limit || 50)],
      ];
      if (input.rep_name) f.push(['rep_name', `ilike.*${input.rep_name}*`]);
      if (input.region) f.push(['primary_region', `ilike.*${input.region}*`]);
      return await sbFetch('route_summary', f);
    }

    if (name === 'query_visit_frequency') {
      const f = [
        ['select', 'rep_name,shop_id,visit_count,first_visit,last_visit'],
        ['order', 'visit_count.desc'],
        ['limit', String(input.limit || 50)],
      ];
      f.push(['rep_name', `ilike.*${input.rep_name}*`]);
      if (input.min_visits) f.push(['visit_count', `gte.${input.min_visits}`]);
      if (input.max_visits) f.push(['visit_count', `lte.${input.max_visits}`]);
      return await sbFetch('visit_frequency', f);
    }

    if (name === 'query_region_breakdown') {
      const f = [['select', '*'], ['order', 'visits.desc']];
      if (input.category) f.push(['category', `ilike.*${input.category}*`]);
      if (input.region) f.push(['region', `ilike.*${input.region}*`]);
      return await sbFetch('user_group_regions', f);
    }

    return { error: `Unknown tool: ${name}` };
  } catch (err) {
    return { error: String(err) };
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'API key not configured on server.' } }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { system, messages, model } = body;
    const useModel = model || 'claude-sonnet-4-6';

    let currentMessages = [...messages];
    const MAX_ITERATIONS = 8;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const claudeRes = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: useModel,
          max_tokens: 8192,
          system,
          messages: currentMessages,
          tools: TOOLS,
        }),
      });

      if (!claudeRes.ok) {
        const errData = await claudeRes.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error ${claudeRes.status}`);
      }

      const data = await claudeRes.json();

      if (data.stop_reason === 'end_turn') {
        const textBlock = data.content.find(c => c.type === 'text');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: [{ type: 'text', text: textBlock?.text || 'No response.' }] }),
        };
      }

      if (data.stop_reason === 'tool_use') {
        const toolBlocks = data.content.filter(c => c.type === 'tool_use');
        currentMessages.push({ role: 'assistant', content: data.content });

        const toolResults = await Promise.all(
          toolBlocks.map(async (block) => {
            const result = await executeToolCall(block.name, block.input);
            const resultStr = JSON.stringify(result);
            const content = resultStr.length > 60000
              ? resultStr.slice(0, 60000) + '... [truncated — ask for a narrower query]'
              : resultStr;
            return { type: 'tool_result', tool_use_id: block.id, content };
          })
        );

        currentMessages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Unexpected stop reason — return whatever text exists
      const textBlock = data.content?.find(c => c.type === 'text');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: [{ type: 'text', text: textBlock?.text || 'Unexpected response format.' }] }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: [{ type: 'text', text: 'I reached the maximum lookup steps. Please try a more specific question.' }],
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: String(err) } }),
    };
  }
};
