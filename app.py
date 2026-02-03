import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

st.set_page_config(
    page_title="Competitor Scatter Analysis",
    page_icon="📊",
    layout="wide"
)

st.title("BuiltWith Competitor Scatter Analysis")

# Info section
with st.expander("ℹ️ Scoring Methodology"):
    st.markdown("""
    - **Platform Score (bubble size):** Shopify/BC/Magento2/Headless=10, WordPress+CDN=7, Legacy=4, Unknown=1
    - **Marketing Score (Y-axis):** GA4+GTM(+3), Ads tags(+2), CMP(+2) - max 10
    - **Conversion Score (X-axis):** A/B testing(+3), Personalisation(+2), Reviews(+2), Chat(+1), Search(+2) - max 10
    """)

def calculate_platform_score(platform: str, cdn: str) -> int:
    """Calculate Platform & Architecture Score (0-10)"""
    if pd.isna(platform):
        return 1
    platform = platform.lower()
    if any(p in platform for p in ['shopify', 'bigcommerce', 'magento 2', 'headless']):
        return 10
    elif 'wordpress' in platform and cdn:
        return 7
    elif any(p in platform for p in ['legacy', 'custom']):
        return 4
    return 1

def calculate_marketing_score(ga4: bool, gtm: bool, google_ads: bool, meta_pixel: bool, cmp: bool) -> int:
    """Calculate Marketing & Tracking Maturity Score (0-10)"""
    score = 0
    if ga4 and gtm:
        score += 3
    if google_ads or meta_pixel:
        score += 2
    if cmp:
        score += 2
    return min(score, 10)

def calculate_conversion_score(ab_testing: bool, personalisation: bool, reviews: bool, chat: bool, site_search: bool) -> int:
    """Calculate Conversion & UX Enablement Score (0-10)"""
    score = 0
    if ab_testing:
        score += 3
    if personalisation:
        score += 2
    if reviews:
        score += 2
    if chat:
        score += 1
    if site_search:
        score += 2
    return min(score, 10)

def get_gap_summary(a_score: int, b_score: int, c_score: int) -> str:
    """Generate gap analysis summary based on scores"""
    if c_score >= 7 and b_score <= 4:
        return "High conversion tooling, weak tracking"
    if a_score >= 7 and c_score <= 4:
        return "Strong stack, weak CRO"
    if b_score >= 7 and c_score <= 4:
        return "Strong tracking, weak UX tooling"
    if a_score >= 7 and b_score >= 7 and c_score >= 7:
        return "Well-rounded maturity"
    if a_score <= 4 and b_score <= 4 and c_score <= 4:
        return "Significant gaps across all areas"
    if b_score >= 7 and c_score >= 7:
        return "Marketing & UX strong, platform lagging"
    if a_score >= 7 and b_score >= 7:
        return "Tech & tracking strong, conversion tooling weak"
    return "Mixed maturity profile"

# Initialize session state for competitors data
if 'competitors' not in st.session_state:
    st.session_state.competitors = pd.DataFrame([
        {
            'Domain': 'example.com',
            'Platform': 'Shopify',
            'CDN': 'Cloudflare',
            'GA4': True,
            'GTM': True,
            'Google Ads': True,
            'Meta Pixel': True,
            'CMP': True,
            'A/B Testing': False,
            'Personalisation': False,
            'Reviews': True,
            'Site Search': False,
            'Chat': True,
        }
    ])

st.subheader("Competitor Data Input")

# Editable dataframe
edited_df = st.data_editor(
    st.session_state.competitors,
    num_rows="dynamic",
    use_container_width=True,
    column_config={
        "Domain": st.column_config.TextColumn("Domain", help="Competitor domain"),
        "Platform": st.column_config.TextColumn("Platform", help="e.g., Shopify, WordPress, Magento 2"),
        "CDN": st.column_config.TextColumn("CDN", help="e.g., Cloudflare, Fastly"),
        "GA4": st.column_config.CheckboxColumn("GA4", help="Google Analytics 4"),
        "GTM": st.column_config.CheckboxColumn("GTM", help="Google Tag Manager"),
        "Google Ads": st.column_config.CheckboxColumn("Ads", help="Google Ads tag"),
        "Meta Pixel": st.column_config.CheckboxColumn("Meta", help="Meta/Facebook Pixel"),
        "CMP": st.column_config.CheckboxColumn("CMP", help="Consent Management Platform"),
        "A/B Testing": st.column_config.CheckboxColumn("A/B", help="A/B Testing tool"),
        "Personalisation": st.column_config.CheckboxColumn("Pers", help="Personalisation tool"),
        "Reviews": st.column_config.CheckboxColumn("Rev", help="Reviews platform"),
        "Site Search": st.column_config.CheckboxColumn("Srch", help="Site search tool"),
        "Chat": st.column_config.CheckboxColumn("Chat", help="Live chat tool"),
    },
    hide_index=True,
)

# Update session state
st.session_state.competitors = edited_df

# Calculate scores for each competitor
scores_data = []
for idx, row in edited_df.iterrows():
    a_score = calculate_platform_score(row.get('Platform', ''), row.get('CDN', ''))
    b_score = calculate_marketing_score(
        row.get('GA4', False),
        row.get('GTM', False),
        row.get('Google Ads', False),
        row.get('Meta Pixel', False),
        row.get('CMP', False)
    )
    c_score = calculate_conversion_score(
        row.get('A/B Testing', False),
        row.get('Personalisation', False),
        row.get('Reviews', False),
        row.get('Chat', False),
        row.get('Site Search', False)
    )
    scores_data.append({
        'Domain': row.get('Domain', f'Competitor {idx + 1}') or f'Competitor {idx + 1}',
        'Platform Score (A)': a_score,
        'Marketing Score (B)': b_score,
        'Conversion Score (C)': c_score,
        'Gap Analysis': get_gap_summary(a_score, b_score, c_score)
    })

scores_df = pd.DataFrame(scores_data)

# Display scores
st.subheader("Calculated Scores")
st.dataframe(
    scores_df,
    use_container_width=True,
    hide_index=True,
    column_config={
        "Platform Score (A)": st.column_config.ProgressColumn(
            "Platform (A)",
            min_value=0,
            max_value=10,
            format="%d",
        ),
        "Marketing Score (B)": st.column_config.ProgressColumn(
            "Marketing (B)",
            min_value=0,
            max_value=10,
            format="%d",
        ),
        "Conversion Score (C)": st.column_config.ProgressColumn(
            "Conversion (C)",
            min_value=0,
            max_value=10,
            format="%d",
        ),
    }
)

# Scatter chart
st.subheader("Competitor Positioning")

if len(scores_df) > 0:
    fig = px.scatter(
        scores_df,
        x='Conversion Score (C)',
        y='Marketing Score (B)',
        size='Platform Score (A)',
        color='Domain',
        hover_name='Domain',
        hover_data={
            'Platform Score (A)': True,
            'Marketing Score (B)': True,
            'Conversion Score (C)': True,
            'Gap Analysis': True,
            'Domain': False
        },
        size_max=50,
    )

    fig.update_layout(
        xaxis=dict(
            title='Conversion & UX Enablement Score',
            range=[-0.5, 10.5],
            dtick=2,
            gridcolor='lightgray',
        ),
        yaxis=dict(
            title='Marketing & Tracking Maturity',
            range=[-0.5, 10.5],
            dtick=2,
            gridcolor='lightgray',
        ),
        height=500,
        showlegend=True,
        legend=dict(
            yanchor="top",
            y=0.99,
            xanchor="left",
            x=1.02
        )
    )

    st.plotly_chart(fig, use_container_width=True)
    st.caption("Bubble size = Platform & Architecture Score (A)")

# Gap Analysis Summary
st.subheader("Gap Analysis Summary")

for idx, row in scores_df.iterrows():
    col1, col2 = st.columns([1, 4])
    with col1:
        st.metric(
            label=row['Domain'],
            value=f"{row['Platform Score (A)'] + row['Marketing Score (B)'] + row['Conversion Score (C)']}/30",
            delta=None
        )
    with col2:
        st.markdown(f"**{row['Gap Analysis']}**")
        st.caption(f"Platform: {row['Platform Score (A)']}/10 | Marketing: {row['Marketing Score (B)']}/10 | Conversion: {row['Conversion Score (C)']}/10")
    st.divider()
