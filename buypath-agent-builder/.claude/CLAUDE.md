# BuyPath Agent Builder

## What this project does
Autonomous system that scans Mike's weekly work across three data sources (Fireflies meetings, Claude conversation patterns, Windsor.ai performance data), identifies the single highest-value automation opportunity, writes a Node.js script to solve it, tests the script, and deploys if tests pass.

## Architecture
- Scanner modules collect intelligence from each data source
- Analyser picks ONE opportunity (highest time saved × frequency × feasibility)
- Builder writes a complete Node.js script using Claude API
- Tester validates the script (8 checks: syntax, API, MCP, errors, config, flags, output, security)
- Deployer saves passing scripts to /agents/ and updates history.json

## Key conventions
- All files use ES modules (.mjs extension, import/export)
- Node 18+ required (for native fetch)
- Claude API model: claude-sonnet-4-20250514 for all calls
- All API calls must have retry logic (3 attempts, exponential backoff)
- All async operations must have try/catch
- Every generated script must support --dry-run and --test flags
- Logs go to both console and /logs/ directory
- History is persisted in /src/state/history.json

## BuyPath client context
- Eden Mobility: Google Ads 497-056-5925, GA4 358880167, GSC https://eden-mobility.co.uk/
- Zyber: Google Ads 190-741-5899, GA4 426037815, GSC https://www.zyberltd.co.uk/, Shopify zyberltd.myshopify.com
- Alan Wood & Partners: Google Ads 335-191-2447, GA4 352908124, GSC https://www.alanwood.co.uk/
- Master Replicas: GA4 511170816
- Eltherington Group: GA4 280072576
- BuyPath Gamma theme: lidxusmu8c3gp8i
- Contact: mike@buypath.co.uk, 07506 289074

## MCP servers available to generated scripts
Generated agent scripts should use Claude API with mcp_servers parameter:
- Fireflies: https://api.fireflies.ai/mcp
- Windsor.ai: https://mcp.windsor.ai
- Gamma: https://mcp.gamma.app/mcp
- Gmail: https://gmail.mcp.claude.com/mcp
- Google Calendar: https://gcal.mcp.claude.com/mcp

## What NOT to do
- Don't hardcode API keys anywhere
- Don't use CommonJS require() — ES modules only
- Don't generate scripts without --dry-run support
- Don't deploy scripts that score below 60/100 on tests
- Don't scan all three sources every time — use smart scan decision based on history
