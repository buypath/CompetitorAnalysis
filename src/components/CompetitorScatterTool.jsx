import React, { useState } from 'react';
import { X, Plus, Info } from 'lucide-react';

const CompetitorScatterTool = () => {
  const [competitors, setCompetitors] = useState([
    {
      id: 1,
      domain: 'example.com',
      platform: 'Shopify',
      cdn: 'Cloudflare',
      ga4: true,
      gtm: true,
      googleAds: true,
      metaPixel: true,
      cmp: true,
      abTesting: false,
      personalisation: false,
      reviews: true,
      siteSearch: false,
      chat: true,
      aScore: 0,
      bScore: 0,
      cScore: 0
    }
  ]);

  const [showInfo, setShowInfo] = useState(false);

  const calculateScores = (comp) => {
    // A) Platform & Architecture Score (0-10)
    let aScore = 0;
    const platform = comp.platform.toLowerCase();
    if (platform.includes('shopify') || platform.includes('bigcommerce') ||
        platform.includes('magento 2') || platform.includes('headless')) {
      aScore = 10;
    } else if (platform.includes('wordpress') && comp.cdn) {
      aScore = 7;
    } else if (platform.includes('legacy') || platform.includes('custom')) {
      aScore = 4;
    } else {
      aScore = 1;
    }

    // B) Marketing & Tracking Maturity Score (0-10)
    let bScore = 0;
    if (comp.ga4 && comp.gtm) bScore += 3;
    if (comp.googleAds || comp.metaPixel) bScore += 2;
    if (comp.cmp) bScore += 2;
    bScore = Math.min(bScore, 10);

    // C) Conversion & UX Enablement Score (0-10)
    let cScore = 0;
    if (comp.abTesting) cScore += 3;
    if (comp.personalisation) cScore += 2;
    if (comp.reviews) cScore += 2;
    if (comp.chat) cScore += 1;
    if (comp.siteSearch) cScore += 2;
    cScore = Math.min(cScore, 10);

    return { aScore, bScore, cScore };
  };

  const updateCompetitor = (id, field, value) => {
    setCompetitors(competitors.map(comp => {
      if (comp.id === id) {
        const updated = { ...comp, [field]: value };
        const scores = calculateScores(updated);
        return { ...updated, ...scores };
      }
      return comp;
    }));
  };

  const addCompetitor = () => {
    const newId = Math.max(...competitors.map(c => c.id), 0) + 1;
    setCompetitors([...competitors, {
      id: newId,
      domain: '',
      platform: '',
      cdn: '',
      ga4: false,
      gtm: false,
      googleAds: false,
      metaPixel: false,
      cmp: false,
      abTesting: false,
      personalisation: false,
      reviews: false,
      siteSearch: false,
      chat: false,
      aScore: 0,
      bScore: 0,
      cScore: 0
    }]);
  };

  const removeCompetitor = (id) => {
    if (competitors.length > 1) {
      setCompetitors(competitors.filter(c => c.id !== id));
    }
  };

  const getGapSummary = (comp) => {
    const { aScore, bScore, cScore } = comp;

    if (cScore >= 7 && bScore <= 4) return "High conversion tooling, weak tracking";
    if (aScore >= 7 && cScore <= 4) return "Strong stack, weak CRO";
    if (bScore >= 7 && cScore <= 4) return "Strong tracking, weak UX tooling";
    if (aScore >= 7 && bScore >= 7 && cScore >= 7) return "Well-rounded maturity";
    if (aScore <= 4 && bScore <= 4 && cScore <= 4) return "Significant gaps across all areas";
    if (bScore >= 7 && cScore >= 7) return "Marketing & UX strong, platform lagging";
    if (aScore >= 7 && bScore >= 7) return "Tech & tracking strong, conversion tooling weak";
    return "Mixed maturity profile";
  };

  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
  ];

  // Chart dimensions - responsive
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const chartWidth = isMobile ? 350 : 600;
  const chartHeight = isMobile ? 400 : 500;
  const padding = isMobile ? 40 : 60;
  const plotWidth = chartWidth - 2 * padding;
  const plotHeight = chartHeight - 2 * padding;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 bg-white">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            BuiltWith Competitor Scatter Analysis
          </h1>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Info className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {showInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
            <p className="font-semibold mb-2">Scoring Methodology:</p>
            <ul className="space-y-1 ml-4">
              <li><strong>Platform Score (bubble size):</strong> Shopify/BC/Magento2/Headless=10, WordPress+CDN=7, Legacy=4, Unknown=1</li>
              <li><strong>Marketing Score (Y-axis):</strong> GA4+GTM(+3), Ads tags(+2), CMP(+2), Server-side(+3) - max 10</li>
              <li><strong>Conversion Score (X-axis):</strong> A/B testing(+3), Personalisation(+2), Reviews(+2), Chat(+1), Search(+2) - max 10</li>
            </ul>
          </div>
        )}
      </div>

      {/* Data Input Section */}
      <div className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Competitor Data Input</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-700">Domain</th>
                <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-700">Platform</th>
                <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-700">CDN</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">GA4</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">GTM</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">Ads</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">Meta</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">CMP</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">A/B</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">Pers</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">Rev</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">Srch</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700">Chat</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700 bg-blue-50">A</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700 bg-green-50">B</th>
                <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-700 bg-purple-50">C</th>
                <th className="px-2 sm:px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((comp, idx) => (
                <tr key={comp.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-2 sm:px-3 py-2">
                    <input
                      type="text"
                      value={comp.domain}
                      onChange={(e) => updateCompetitor(comp.id, 'domain', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                      placeholder="example.com"
                    />
                  </td>
                  <td className="px-2 sm:px-3 py-2">
                    <input
                      type="text"
                      value={comp.platform}
                      onChange={(e) => updateCompetitor(comp.id, 'platform', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                      placeholder="Shopify"
                    />
                  </td>
                  <td className="px-2 sm:px-3 py-2">
                    <input
                      type="text"
                      value={comp.cdn}
                      onChange={(e) => updateCompetitor(comp.id, 'cdn', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                      placeholder="CF"
                    />
                  </td>
                  {['ga4', 'gtm', 'googleAds', 'metaPixel', 'cmp', 'abTesting', 'personalisation', 'reviews', 'siteSearch', 'chat'].map(field => (
                    <td key={field} className="px-2 sm:px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={comp[field]}
                        onChange={(e) => updateCompetitor(comp.id, field, e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </td>
                  ))}
                  <td className="px-2 sm:px-3 py-2 text-center font-semibold bg-blue-50">{comp.aScore}</td>
                  <td className="px-2 sm:px-3 py-2 text-center font-semibold bg-green-50">{comp.bScore}</td>
                  <td className="px-2 sm:px-3 py-2 text-center font-semibold bg-purple-50">{comp.cScore}</td>
                  <td className="px-2 sm:px-3 py-2">
                    <button
                      onClick={() => removeCompetitor(comp.id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      disabled={competitors.length === 1}
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={addCompetitor}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Competitor
          </button>
        </div>
      </div>

      {/* Scatter Chart */}
      <div className="border border-gray-200 rounded-lg p-4 sm:p-6 bg-white mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Competitor Positioning</h2>

        <div className="overflow-x-auto">
          <svg width={chartWidth} height={chartHeight} className="mx-auto">
            {/* Grid lines */}
            {[0, 2, 4, 6, 8, 10].map(val => (
              <g key={`grid-${val}`}>
                <line
                  x1={padding}
                  y1={padding + plotHeight - (val * plotHeight / 10)}
                  x2={padding + plotWidth}
                  y2={padding + plotHeight - (val * plotHeight / 10)}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <line
                  x1={padding + (val * plotWidth / 10)}
                  y1={padding}
                  x2={padding + (val * plotWidth / 10)}
                  y2={padding + plotHeight}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              </g>
            ))}

            {/* Axes */}
            <line x1={padding} y1={padding + plotHeight} x2={padding + plotWidth} y2={padding + plotHeight} stroke="#374151" strokeWidth="2" />
            <line x1={padding} y1={padding} x2={padding} y2={padding + plotHeight} stroke="#374151" strokeWidth="2" />

            {/* Axis labels */}
            <text x={chartWidth / 2} y={chartHeight - 10} textAnchor="middle" className="text-xs sm:text-sm font-medium fill-gray-700">
              Conversion & UX Enablement Score
            </text>
            <text x={15} y={chartHeight / 2} textAnchor="middle" transform={`rotate(-90 15 ${chartHeight / 2})`} className="text-xs sm:text-sm font-medium fill-gray-700">
              Marketing & Tracking Maturity
            </text>

            {/* Tick labels */}
            {[0, 2, 4, 6, 8, 10].map(val => (
              <g key={`tick-${val}`}>
                <text x={padding + (val * plotWidth / 10)} y={padding + plotHeight + 15} textAnchor="middle" className="text-xs fill-gray-600">
                  {val}
                </text>
                <text x={padding - 8} y={padding + plotHeight - (val * plotHeight / 10) + 4} textAnchor="end" className="text-xs fill-gray-600">
                  {val}
                </text>
              </g>
            ))}

            {/* Data points */}
            {competitors.map((comp, idx) => {
              const x = padding + (comp.cScore * plotWidth / 10);
              const y = padding + plotHeight - (comp.bScore * plotHeight / 10);
              const radius = 8 + (comp.aScore * 2);
              const color = colors[idx % colors.length];

              return (
                <g key={comp.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={color}
                    opacity="0.7"
                    stroke={color}
                    strokeWidth="2"
                  />
                  <text
                    x={x}
                    y={y - radius - 5}
                    textAnchor="middle"
                    className="text-xs font-medium fill-gray-700"
                  >
                    {comp.domain || `Comp ${idx + 1}`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-4 text-xs text-gray-600 text-center">
          Bubble size = Platform & Architecture Score (A)
        </div>
      </div>

      {/* Gap Summary */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Gap Analysis Summary</h2>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {competitors.map((comp, idx) => (
              <div key={comp.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div
                  className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{comp.domain || `Competitor ${idx + 1}`}</div>
                  <div className="text-sm text-gray-600 mt-1">{getGapSummary(comp)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Platform: {comp.aScore}/10 | Marketing: {comp.bScore}/10 | Conversion: {comp.cScore}/10
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitorScatterTool;
