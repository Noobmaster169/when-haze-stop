# 03. Source-receptor attribution of transboundary haze for Kuala Lumpur and surroundings

Research date: 2026-10-10. Scope: which Indonesian and Malaysian fire regions drive PM2.5 in Kuala Lumpur, Selangor, Putrajaya and Negeri Sembilan; how the Harvard/Columbia adjoint framework works and what it found; the transport facts a cheap model needs; what share is local; and counterfactual results. Each section separates **Established** (stated in a cited source) from **Inference** (my reasoning, or general knowledge I did not re-verify this session).

Method note: the web-search budget for this turn ran out near the end. Gaps are listed in section 9.

---

## 1. Headline findings for a KL-centred product

1. **For Kuala Lumpur the dominant source is central Sumatra (Riau and northern Jambi), not South Sumatra.** Across 2004 to 2009, fires in central Sumatra gave 69 to 74% of the fire enhancement to PM2.5 in Kuala Lumpur and Pekanbaru. Southern Sumatra added 17 to 20%, and only in August to October (Reddington et al. 2014, ERL). For September 2019 in Greater KL, Riau plus Jambi gave about 97% of the modelled fire PM2.5 from the three provinces modelled, and South Sumatra only 1 to 3% (Murulitharan, Archibald and Giorio, EGU24 abstract; Murulitharan 2025 Cambridge PhD).
2. **For Singapore, and for the regional population-weighted exposure, the dominant source is southeastern Sumatra** (South Sumatra, eastern Jambi, Lampung). This is the source most of the policy literature ranks first (Kim et al. 2015; Koplitz et al. 2016; Marlier et al. 2019; Reddington et al. 2014). A KL product must not copy the Singapore or regional ranking.
3. **For Kuching and western Sarawak the dominant source is West Kalimantan.** ASMC and Sarawak NREB attribute western Sarawak haze to West Kalimantan smoke drifting north, and the 2026 episode followed the same pattern.
4. **Where the fire is matters more than how big it is.** Sumatra made 37% of regional fire emissions in 2006 but caused 63% of population-weighted exposure (Kim et al. 2015). Under business-as-usual, Sumatra supplied 29% of emissions but about 62% of Singapore's smoke (Marlier et al. 2015).
5. **Peat is the most valuable thing to target.** Blocking peatland fires would cut Malaysia's July to October smoke exposure by 71% and Malaysian deaths by about 73%. Blocking concession fires would cut exposure by 60%, and blocking conservation-area fires by only 9% (Marlier et al. 2019, GeoHealth).
6. **The adjoint result is linear: exposure = sum over cells of (sensitivity x emission).** Koplitz et al. (2016) describe the calculation as "effectively a one-step multiplication" that takes seconds. A Lagrangian backward-footprint model reproduces the same structure cheaply.

---

## 2. Which source regions drive PM2.5 in KL, by season

### 2.1 Established

**Reddington, C. L., Yoshioka, M., Balasubramanian, R., Ridley, D., Toh, Y. Y., Arnold, S. R., Spracklen, D. V. (2014). "Contribution of vegetation and peat fires to particulate air pollution in Southeast Asia." Environmental Research Letters 9, 094006.** https://doi.org/10.1088/1748-9326/9/9/094006 (open-access copy: https://eprints.whiterose.ac.uk/82716/)
- Methods: the GLOMAP global aerosol model at 2.8 x 2.8 degrees with fire emissions switched off region by region (2004 to 2009). It was checked against ROTRAJ Lagrangian back trajectories: 5 days long, released every 6 h, on 1.0125-degree winds, weighted by residence time over GFED3 CO emissions on a 0.5-degree grid.
- Region definitions: "Cen.Sumatra" is roughly 1 S to 2.5 N, which is Riau plus northern Jambi and West Sumatra. "S.Sumatra" is south of 1 S (Jambi south, South Sumatra, Lampung). "N.Sumatra" is north of 2.5 N. "PenMalaysia" is Peninsular Malaysia.
- **Kuala Lumpur:** "considerable contribution from fires to PM2.5 throughout the year with the largest contribution from fires in central Sumatra (69–74% of the total fire enhancement). ... also impacted by fire emissions from southern Sumatra during August–October (17–20%)."
- **Singapore:** southern Sumatra 42 to 62%, central Sumatra 21 to 35%, Kalimantan 14 to 15%, Peninsular Malaysia about 2 to 3% (about 4% in La Nina years). The monthly peaks are in September and October.
- **Batam:** southern Sumatra 51%, central Sumatra 23%, Indonesian Borneo 15%.
- **Distance lesson:** "fires in central Sumatra that are closest to Singapore were not the dominant source ... Instead, fires in South Sumatra (located ~550 km from Singapore) contributed more."
- Recommended priorities, for Singapore: eastern Jambi, South Sumatra and Lampung; eastern Riau; and the southern parts of West, Central and South Kalimantan.
- Caveat: at 2.8 degrees, KL and Pekanbaru are about one grid cell apart, so the KL split is coarse. Models underpredict fire aerosol, and other studies needed scaling factors of about 2 to 5.

**Murulitharan, J., Archibald, A., Giorio, C. (2024). "Uncovering the effect of fires in Jambi, Riau, and South Sumatra on PM2.5 concentration levels in Greater Kuala Lumpur during September 2019 transboundary haze pollution." EGU General Assembly 2024, EGU24-8954.** https://meetingorganizer.copernicus.org/EGU24/EGU24-8954.html. The full work is **Murulitharan, J. (2025). "Assessing PM2.5 pollution and the role of transboundary pollution emissions across Greater Kuala Lumpur, Malaysia from 2018 to 2023." PhD thesis, University of Cambridge**, doi:10.17863/CAM.117887, https://www.repository.cam.ac.uk/items/1fe4b54e-0016-48a3-afd3-4fcce809e24f
- Methods: Met Office NAME backward runs combined with GFASv1.2 emissions over 5 S to 10 N and 95 to 110 E, compared with 8 Greater KL DOE stations.
- In September 2019, 80 to 100% of days exceeded the Malaysian standard and the WHO daily PM2.5 guideline.
- Riau, Jambi, South Sumatra and Lampung made more than 95% of September Sumatran emissions. The three study provinces made about 94% of all September emissions in the domain.
- Fire emissions correlated with Greater KL PM2.5 at Spearman rho = 0.747 (p < 0.001); in the thesis, rho = 0.6 to 0.8. The model's correlation with observations was 0.62 to 0.70, with a bias of -3 to -12 ug/m3 (underestimate).
- The smoke reached Greater KL along a **southwestern air pathway**.
- **Station split.** Riau dominated at Klang (56 to 59%), Kuala Selangor (51 to 53%) and Bangi (56 to 59%). Jambi dominated at Batu Muda (57 to 58%), Petaling Jaya (51 to 52%), Cheras (55 to 56%) and Putrajaya (44 to 55%). Shah Alam was about even. South Sumatra gave 1 to 3%.
- Implication: even inside the Klang Valley, the western and coastal stations lean to Riau and the eastern and southern stations lean to Jambi. Two stations about 30 km apart can have different source mixes, which Hansen et al. (2019) also found in Singapore.

**Lawrence, Koe and McGregor (2001)**, as summarised in later literature (DARLAM trajectories, 1997): "Kuala Lumpur was heavily affected by the haze coming from Sumatra, while Singapore was more affected by fires from Kalimantan than was Kuala Lumpur ... mainly a result of the shifting of monsoons." Backward trajectories from KL ending 17 September 1997 traced nearly all paths to Sumatra at 950, 850 and 700 hPa. (Secondary citation; I did not read the original.) Koe et al. (2001), "Investigating the haze transport from 1997 biomass burning in Southeast Asia: its impact upon Singapore," Atmospheric Environment: https://experts.arizona.edu/en/publications/investigating-the-haze-transport-from-1997-biomass-burning-in-sou/

**Amil, N., Latif, M. T., Khan, M. F., Mohamad, M. (2016). "Seasonal variability of PM2.5 composition and sources in the Klang Valley urban-industrial environment." Atmos. Chem. Phys. 16, 5357–5381.** https://acp.copernicus.org/articles/16/5357/2016/
- Petaling Jaya, August 2011 to July 2012: annual PM2.5 was 28 +/- 18 ug/m3. Haze episodes averaged 61 +/- 24 ug/m3.
- PMF factors: mixed secondary inorganic aerosol plus biomass burning 42%, engine-oil combustion 17%, sea salt 17%, mineral dust 14%, traffic and industry 10%.
- The worst exceedance seasons were the southwest monsoon (66% of days above the WHO daily guideline) and the second inter-monsoon (71%). 48-h HYSPLIT trajectories released at 500 m traced haze samples back to Sumatra.

**Kusumaningtyas, S. D. A., Aldrian, E. (2016). "Impact of the June 2013 Riau province Sumatera smoke haze event on regional air pollution." ERL 11, 075007.** https://doi.org/10.1088/1748-9326/11/7/075007. HYSPLIT plus a one-day lag correlation: Riau smoke reached Singapore about one day after the fires.

**Hansen, A. B., Witham, C. S., Chong, W. M., et al. (2019). "Haze in Singapore – source attribution of biomass burning PM10 from Southeast Asia." Atmos. Chem. Phys. 19, 5363–5385.** https://acp.copernicus.org/articles/19/5363/2019/
- Methods: NAME 10-day backward runs every day from 2010 to 2015, on a 0.1-degree footprint grid over the 0 to 2 km layer. GFAS v1.2 emissions with GFAS injection heights, split into 29 source regions.
- Findings: August to October is the main season. The five dominant regions were Riau, Peninsular Malaysia, South Sumatra, Central Kalimantan and West Kalimantan.
- August to October 2015: South Sumatra 22 to 38%, Central Kalimantan 31 to 41%, Bangka-Belitung 11 to 14%, West Kalimantan 7 to 9%, Jambi 6%.
- June 2013: Riau about 98%. August to October 2010: Riau at least 90%.
- **February to April 2014: Peninsular Malaysia more than 90%.** Off-season episodes are each dominated by one source region.
- This paper is a methodological template for the product: backward footprints multiplied by gridded emissions.

**Agency attribution (non-peer-reviewed).** ASMC statements in 2019 put Peninsular Malaysia haze down to Sumatra and Sabah and Sarawak haze down to Kalimantan. In October 2023, ASMC described persistent hotspot clusters in South Sumatra whose smoke was carried northwest. Indonesia disputed this. https://asmc.asean.org/haze-review-of-regional-haze-situation-for-october-2023/

### 2.2 Season by season

| Period | Low-level flow over Sumatra and the Straits | Main source for KL | Main source for Singapore | Main source for Kuching |
|---|---|---|---|---|
| Feb to Mar (dry spell) | NE monsoon tail | Central Sumatra and local Peninsular fires | Central Sumatra; Peninsular Malaysia in 2014 | Minor |
| Jun to Aug (SW monsoon) | Southwesterly or southerly over the Straits; westerly over Riau in June | **Riau (central Sumatra)**, with a short path | Riau when winds turn westerly (June 2013) | West Kalimantan |
| Sep (late SW monsoon) | South-southwesterly over the Straits; southeasterly south of the equator | **Riau and Jambi** (2019); South Sumatra adds 17 to 20% | South Sumatra | West Kalimantan |
| Oct (inter-monsoon, from about 9 Oct 2026) | Weak, variable; afternoon thunderstorms | Falls off; South Sumatra and Jambi when SE flow persists (2015, 2023) | South Sumatra and Kalimantan | West and Central Kalimantan |

Established parts of the table: Koplitz et al. (2016) state that Riau winds shift "from westerly in June to southeasterly during September–October" as the ITCZ moves south. MetMalaysia stated on 6 October 2026 that the southwest monsoon (from 14 May) ends on 9 October, and that the inter-monsoon brings "weak winds from various directions" with afternoon and evening thunderstorms. https://www.thestar.com.my/news/nation/2026/10/06/cross-border-haze-expected-to-clear-from-oct-9-as-inter-monsoon-period-begins

Inference: the table cells for February to March and for Kuching are my synthesis from the sources above.

### 2.3 Episodes

- **1997:** KL trajectories at 950, 850 and 700 hPa came from Sumatra. Kuching (API about 839 in September 1997, from memory, not re-verified) came from Kalimantan.
- **2006:** For the population-weighted Malaysia receptor, South Sumatra was the largest contributor and West Kalimantan second (Koplitz et al. 2016).
- **2013 (June):** A Riau-only event. In Singapore it was about 98% Riau (Hansen et al. 2019) and arrived after about one day (Kusumaningtyas and Aldrian 2016).
- **2015:** Malaysian July to October exposure averaged 14 ug/m3, against 6 in 2006. South Sumatra and Jambi drove the increase. Koplitz et al. (2016) report Riau "did not contribute significantly to smoke exposure at any receptor during either the 2006 or 2015 haze events". This covers the September to October peak and the whole-Malaysia population-weighted receptor, which includes Borneo.
- **2019 (September):** Riau and Jambi dominated Greater KL, and South Sumatra contributed little (Murulitharan).
- **2023 (October):** ASMC recorded the most Sumatran and Kalimantan hotspots in five years, with dense smoke over southern and central Sumatra. Malaysia attributed its haze to South Sumatra; Indonesia denied it.
- **2026 (current):** ASMC raised Alert Level 2 on 3 August (Kalimantan) and Level 3 on 26 August. On 29 September, ASMC counted 327 hotspots in Kalimantan and 191 in Sumatra. On 8 October, 38 of 68 DOE stations read unhealthy, including Cheras 172, Batu Muda 168, Putrajaya 173, Shah Alam 170, Johan Setia 178 and Segamat 187. The haze was expected to ease from 9 October with the inter-monsoon. https://www.malaymail.com/news/malaysia/2026/10/08/haze-persists-as-38-areas-record-unhealthy-api-segamat-highest-at-187/238182 ; https://asmc.asean.org/alert20260826-activation-of-alert-level-3-for-the-southern-asean-region/ ; https://www.thestar.com.my/news/nation/2026/08/20/haze-in-sarawak-to-persist-as-transboundary-smoke-drifts-from-kalimantan

---

## 3. The Harvard/Columbia adjoint framework and the Smoke Policy Tool

### 3.1 How it works (established)

**Kim, P. S., Jacob, D. J., Mickley, L. J., Koplitz, S. N., Marlier, M. E., DeFries, R. S., Myers, S. S., Chew, B. N., Mao, Y. H. (2015). "Sensitivity of population smoke exposure to fire locations in Equatorial Asia." Atmospheric Environment 102, 11–17.** https://doi.org/10.1016/j.atmosenv.2014.09.045 (manuscript: https://dash.harvard.edu/entities/publication/73120378-ddbf-6bd4-e053-0100007fdf3b)

- GEOS-Chem driven by GEOS-5 meteorology, nested at 0.5 x 0.67 degrees over East Asia inside a 4 x 5 degree global run. The tracer is fire OC+BC (smoke).
- Emissions are GFED3, scaled up by 50% for small fires. The fire season modelled is July to November 2006. Surface winds that year matched the 2004 to 2010 mean, even though 2006 was an El Nino year.
- The core equation (their Eq. 1):
  PM(x_R, t') = integral over t in [t0, t'] and over x of [dPM(x_R, t') / dE(x, t)] * E(x, t) dx dt.
  **One adjoint run per receptor gives the sensitivity of that receptor to emissions in every grid cell at every earlier time.** The receptor can also be a population-weighted average over a region.
- Evaluation: against 50 Malaysian DOE and Singapore NEA PM10 sites, using smoke defined as the excess over the bracketing non-burning months (June and December). Spatial r = 0.84. Observed July to November smoke was typically 10 to 50 ug/m3. The model underestimates northern Malaysian Borneo because of terrain it cannot resolve.
- Results:
  - Singapore is "particularly sensitive to fires in southeastern Sumatra". Jakarta has no sensitivity to Sumatra or Borneo.
  - The population-weighted region is much more sensitive to Sumatra than to Borneo.
  - Sumatra made 37% of 2006 emissions but caused **64% of Singapore smoke** and **63% of population-weighted exposure**.
  - Under a High Oil Palm future, Singapore smoke falls because emissions move away from southeastern Sumatra, while population-weighted exposure rises 60%. Peat Protection cuts smoke against High Oil Palm by a factor of 4 for Singapore and 2 regionally.
  - Policy: protect the peat swamp forests of southeastern Sumatra.

**Koplitz, S. N., Mickley, L. J., Marlier, M. E., Buonocore, J. J., Kim, P. S., Liu, T., Sulprizio, M. P., DeFries, R. S., Jacob, D. J., Schwartz, J., Pongsiri, M., Myers, S. S. (2016). "Public health impacts of the severe haze in Equatorial Asia in September–October 2015: demonstration of a new framework for informing fire management strategies to reduce downwind smoke exposure." ERL 11, 094023.** https://doi.org/10.1088/1748-9326/11/9/094023
- Receptors are population-weighted Indonesia, Malaysia and Singapore. The adjoint sensitivities (2006 meteorology, with 2005 to 2009 alternatives) are multiplied by GFAS emissions.
- Meteorology sensitivity: exposures were similar across 2005 to 2008 sensitivities; 2009 came out about 25% higher.
- July to October exposure, 2015 against 2006: Indonesia 19 against 8, **Malaysia 14 against 6**, Singapore 27 against 10 ug/m3. Singapore's modelled 27 compares with 30 observed by NEA.
- Excess deaths: 100,300 in 2015 against 37,600 in 2006. Malaysia's share was 6,500 against 2,300.
- **South Sumatra** made more than 30% of emissions but caused more than 50% of regional exposure in both years. It made 62% (1.3 Tg) of the 2015 emission increase.
- Central Kalimantan made 31% of 2006 emissions, yet its exposure contribution was less than a third of South Sumatra's.
- Jambi made under 5% of the 2006 haze. In 2015 it was the third-largest emitter, its contribution doubled, and it caused about 20% of the increased exposure.
- **West Kalimantan was the second-largest contributor to Malaysian exposure in 2006**, after South Sumatra.
- Riau was not significant in either September to October event.
- Shares of 1-km MODIS FRP in 2015: peat 72% in Sumatra and 43% in Kalimantan; timber concessions 55% in Sumatra.
- The exposure step is "effectively a one-step multiplication", "requiring minimal computational resources", which allows "near real-time assessment".

**Marlier, M. E., DeFries, R. S., Kim, P. S., Koplitz, S. N., Jacob, D. J., Mickley, L. J., Myers, S. S. (2015). "Fire emissions and regional air quality impacts from fires in oil palm, timber, and logging concessions in Indonesia." ERL 10, 085005.** Companion paper: **Marlier et al. (2015). "Regional air quality impacts of future fire emissions in Sumatra and Kalimantan." ERL 10, 054010.** https://doi.org/10.1088/1748-9326/10/5/054010
- Business-as-usual 2010 to 2030: Singapore smoke is about 62% from Sumatra and 38% from Kalimantan, although Sumatra supplies only about 29% of emissions in the burning season. Palembang is 99% Sumatra. The population-weighted region is about 50/50.
- Peatland protection reduces smoke by **70% in Singapore, 40% in Palembang and 60% regionally**. Emissions fall 59%.
- Future fire emissions are injected into the boundary layer, "following observations that 95% of Indonesian smoke plumes are injected there."
- Per-unit-emission ratio, Sumatra to Kalimantan, derived from their Table 3: about **4.0x for Singapore** and **2.4x for the population-weighted region**.

**Marlier, M. E., Liu, T., Yu, K., Buonocore, J. J., Koplitz, S. N., DeFries, R. S., Mickley, L. J., Jacob, D. J., Schwartz, J., Wardhana, B. S., Myers, S. S. (2019). "Fires, smoke exposure, and public health: an integrative framework to maximize health benefits from peatland restoration." GeoHealth 3(7), 178–189.** https://doi.org/10.1029/2019GH000191 (open access: https://pmc.ncbi.nlm.nih.gov/articles/PMC7007093/)
- GEOS-Chem adjoint v8-02-01 at 0.5 x 0.67 degrees, with linear source-receptor relationships and meteorological years 2005 to 2009.
- Business-as-usual 2020 to 2029: 36,000 excess deaths per year. Malaysia: 2,400 deaths per year (2,200 to 2,600) at 5.5 ug/m3 of July to October smoke PM2.5.
- Scenario table, July to October exposure and Malaysian deaths:

  | Scenario | Emission cut | Malaysia exposure (BAU 5.5) | Malaysia exposure cut | Malaysia deaths/yr (BAU 2,400) |
  |---|---|---|---|---|
  | Block peatland fires | -65% | 1.6 | **-71%** | 630 |
  | Block concession fires | -39% | 2.2 | **-60%** | 900 |
  | Block conservation-area fires | -24% | 5.0 | -9% | 2,100 |
  | Restore all BRG priority sites | -39% | 4.2 | -24% | 1,800 |

- Read on the table: for Malaysia, concessions give 1.5 units of exposure cut per unit of emission cut, and peat gives 1.1. BRG sites give 0.6 for Malaysia against 1.2 for Singapore. **The BRG restoration sites are less well placed for Malaysia than for Singapore**, because they lie mostly in southern Sumatra and Kalimantan.
- The tool ranks the top five BRG sites per receptor and prioritises eastern Sumatra, with the east coast of South Sumatra first for all three countries. That ranking is in supplementary Figure S6, which I could not read.
- **SMOKE Policy Tool:** https://smokepolicytool.users.earthengine.app/view/smoke-policy-tool (Google Earth Engine). Users pick fire years from 2005, future years to 2029, meteorology years 2005 to 2009, a receptor (Indonesia, Malaysia or Singapore) and province or land-use scenarios. Health results are national. Commentary: https://theconversation.com/we-built-an-app-to-detect-areas-most-vulnerable-to-life-threatening-haze-122388. It names the east coast of South Sumatra first, then the southern coasts of West, Central and South Kalimantan.

### 3.2 Other attribution and emission papers

- **Kiely, L., Spracklen, D. V., Wiedinmyer, C., et al. (2019). "New estimate of particulate emissions from Indonesian peat fires in 2015." ACP 19, 11105–11121.** https://acp.copernicus.org/articles/19/11105/2019/
  - Primary PM2.5 from Sumatra and Borneo in September to October 2015 was 7.33 Tg. That is 3.5x FINNv1.5, which has no peat, and 1.8x GFED4s, because of updated peat emission factors.
  - Peat made 71% of primary PM2.5.
  - Scaling peat burn depth by satellite soil moisture raised the model-observation correlation from 0.48 to 0.56.
- **Kiely, L., et al. (2020). "Air quality and health impacts of vegetation and peat fires in Equatorial Asia during 2004–2015." ERL 15, 094054.** https://doi.org/10.1088/1748-9326/ab9a6c
  - 2015 dry-season PM emissions were 9.4 Tg, against a 2.7 Tg average. Sumatra and Kalimantan made 94% of fire PM.
  - Peat made 45% of PM emissions over the period and 68% in 2015.
  - About 44,040 excess deaths in 2015 and 131,700 over 2004 to 2015.
- **Kiely, L., et al. (2021). "Assessing costs of Indonesian fires and the benefits of restoring peatland." Nature Communications 12, 7044.** https://doi.org/10.1038/s41467-021-27353-x. 2015 fire losses were about US$28 billion. Restoring 2.49 Mha costs US$3.2 to 7 billion, and the benefits exceed the cost.
- **Crippa, P., et al. (2016). "Population exposure to hazardous air quality due to the 2015 fires in Equatorial Asia." Scientific Reports 6, 37074.** https://doi.org/10.1038/srep37074. WRF-Chem at about 10 km. About 69 million people were exposed to unhealthy air, with 11,880 short-term excess deaths.
- **Mead, M. I., et al. (2018). "Impact of the 2015 wildfires on Malaysian air quality and exposure: a comparative study of observed and modeled data." ERL.** https://dspace.lib.cranfield.ac.uk/handle/1826/13262. WRF-Chem against 49 Malaysian stations. More than 60% of Greater Klang Valley residents were systematically exposed to unhealthy or hazardous levels in September to October 2015.
- **Aouizerats, B., et al. (2015). ACP 15, 363–373.** https://acp.copernicus.org/articles/15/363/2015/. WRF-Chem with and without fires, for Singapore in 2006. Fires gave about 21% of July to October PM10 mass. Of 35 days above 50 ug/m3, 17 were fire-driven and 18 were local pollution with recirculation.
- **Hu, Y., Fernandez-Anez, N., Smith, T. E. L., Rein, G. (2018). "Review of emissions from smouldering peat fires and their contribution to regional haze episodes." International Journal of Wildland Fire 27(5), 293–312.** https://doi.org/10.1071/WF17084. Emission factors for smouldering peat are highly uncertain, and modified combustion efficiency is a poor regime indicator. Tropical peat has higher organic-compound emission factors and slightly lower PM2.5 emission factors than boreal peat.
- **Lee, H.-H., et al. (2018). ACP 18, 6141–6156.** https://acp.copernicus.org/articles/18/6141/2018/. Fire and non-fire sources together raise the chance of a moderate-or-worse 24-h AQI from 23% to 34%. Cutting fires alone is not enough.

### 3.3 Mimicking the adjoint cheaply (inference, based on the established structure)

The adjoint gives a matrix S[r, cell, lag], the change in receptor concentration per unit emission. A Lagrangian **backward** model builds the same object directly:
- Release particles from the receptor and run them backwards in time.
- Record how long they spend in each grid cell below the mixing height. This is the footprint F(cell, lag), in s m^-1 or equivalent.
- Then S = F / h_mix to first order.

This is exactly what Hansen et al. (2019) did with NAME (10-day backward runs, 0 to 2 km layer, 0.1-degree grid) and what Reddington et al. (2014) did with ROTRAJ (5-day trajectories weighted by residence time over CO emissions). One backward run per receptor per hour covers every hotspot, so the cost grows with the number of receptors, not the number of fires. The forward alternative grows with the number of hotspots.

---

## 4. Transport mechanics for a cheap model

### 4.1 Distances and bearings (computed great-circle; bearing = direction from source to receptor; wind must blow *toward* this bearing)

| Source | to KL | to Port Klang | to Singapore | to Kuching |
|---|---|---|---|---|
| Rupat Island north tip (2.10 N, 101.66 E) | 116 km @ 0 deg (Port Dickson 49 km, Melaka 66 km, Seremban 76 km, Putrajaya 92 km) | 104 km | about 270 km | about 990 km |
| Dumai (1.67 N, 101.45 E) | 166 km @ 9 deg | 148 km @ 358 deg | 266 km @ 98 deg | 989 km |
| Bengkalis (1.47 N, 102.10 E) | 191 km @ 346 deg | 187 km | 192 km @ 94 deg | 916 km |
| Siak/Kampar peat (0.8 N, 102.3 E) | 269 km @ 345 deg | 265 km | 180 km @ 70 deg | 898 km |
| Pekanbaru (0.51 N, 101.45 E) | 294 km @ 5 deg | 277 km | 280 km @ 70 deg | 996 km |
| Medan (3.60 N, 98.67 E) | 338 km @ 99 deg | 309 km | 624 km | 1,316 km |
| Jambi city (1.61 S, 103.61 E) | 570 km @ 338 deg | 569 km | 330 km @ 4 deg | 827 km |
| Palembang (2.98 S, 104.78 E) | 762 km @ 333 deg | 764 km | 493 km @ 348 deg | 798 km |
| OKI peat, South Sumatra (3.4 S, 105.6 E) | 847 km @ 329 deg | 852 km | 564 km | 762 km |
| Pontianak (0.03 S, 109.34 E) | 921 km @ 293 deg | 946 km | 633 km @ 284 deg | 208 km @ 32 deg |
| Ketapang (1.85 S, 109.98 E) | 1,076 km | 1,096 km | 772 km | 381 km @ 6 deg |
| Palangka Raya (2.21 S, 113.92 E) | 1,484 km @ 294 deg | 1,508 km | 1,191 km | 577 km @ 316 deg |
| Kuala Langat peat, Selangor (2.80 N, 101.55 E) | 41 km | 28 km | 299 km | 987 km |
| Pekan peat, Pahang (3.4 N, 103.3 E) | 181 km @ 261 deg | 216 km | 235 km | 809 km |

What reaches KL under which wind (inference from geometry):
- Riau's coast needs **southerly** flow (from about 180 to 190 degrees).
- Jambi needs **south-southeasterly** flow (from about 158 degrees).
- South Sumatra needs **southeasterly** flow (from about 150 degrees).
- Kalimantan needs **east-southeasterly** flow (from about 113 degrees) held over about 1,000 km.
- The prevailing southwesterly flow over the Straits carries Riau smoke toward Melaka, Negeri Sembilan and Johor rather than straight to KL. A slight backing to southerly sends it into the Klang Valley.
- The SE-to-S flow south of the equator recurves toward the SW after crossing it, the cross-equatorial monsoon turn. That curved path is how South Sumatra and Jambi smoke reaches the Peninsula, and why straight-line plume geometry fails beyond about 300 km.

### 4.2 Transport time

Established:
- TAPM simulation of August 2005: Riau smoke reached the west coast of the Peninsula about 17 h into the run.
- A companion analysis (Mahmud, UKM, NASA LCLUC 2009 presentation) found plumes stayed local for the first 24 h, then lay over the west coast within 36 to 48 h, affecting Selangor, Pahang, Negeri Sembilan and Melaka. Near-stagnant low-level winds in early August 2005 held smoke near the sources. https://gslcluc1.umd.edu/sites/default/files/lcluc_documents/mahmud_lcluc_jan2009_day2_presentation_0.pdf (secondary summary; the PDF did not load)
- Riau to Singapore takes about one day (Kusumaningtyas and Aldrian 2016).
- MISR plumes in Borneo had a median age of 2.8 h at the far end of the visible plume. The smoke follows the prevailing southeasterly surface wind at 3 to 4 m/s (Zender et al. 2012).
- A poster found a 4-day lag between peak Sumatran hotspot counts and peak PM10 in Petaling Jaya in June 2013. It is weak evidence: the authors hypothesised lofting followed by mixing back down.

Inference, using distance divided by speed at 5 m/s (432 km per day) and 8 m/s (691 km per day) along a straight path. Curved paths take longer.

| Source | 5 m/s | 8 m/s |
|---|---|---|
| Rupat | 6 h | 4 h |
| Dumai | 9 h | 6 h |
| Pekanbaru | 16 h | 10 h |
| Jambi | 32 h | 20 h |
| Palembang | 42 h | 26 h |
| Pontianak | 51 h | 32 h |
| Palangka Raya | 82 h | 52 h |

Practical rule: **Riau smoke reaches KL in under a day; Jambi and South Sumatra smoke in 1 to 2.5 days; Kalimantan smoke in 2 to 4 days.** So a suppression ranking should be driven by the **forecast** wind for the next 0 to 72 h, not the current wind.

Not found: an 850 hPa wind climatology for the Straits in figures. MetMalaysia describes the southwest monsoon as steady southwesterlies. Inference, from general climatology I did not re-verify: low-level (925 to 850 hPa) monsoon winds over the Straits are typically 3 to 10 m/s. The near-equatorial "doldrum" band and the inter-monsoon are weaker and variable, which is why stagnation episodes (August 2005, October inter-monsoon) occur.

### 4.3 Injection height

Established:
- **Tosca, M. G., Randerson, J. T., Zender, C. S., Nelson, D. L., Diner, D. J., Logan, J. A. (2011). "Dynamics of fire plumes and smoke clouds associated with peat and deforestation fires in Indonesia." JGR 116, D08207.** MISR plume heights for 2001 to 2009 averaged about 709 m in Borneo (n = 317) and 749 m in Sumatra (n = 139). **96% of plumes were within 500 m of the boundary-layer top.** Regional smoke clouds sat at 1 to 2 km. Direct injection into the free troposphere was "not an important mechanism". Plumes were higher in El Nino years.
- **Zender, C. S., Krolewski, A. G., Tosca, M. G., Randerson, J. T. (2012). "Tropical biomass burning smoke plume size, shape, reflectance, and age based on 2001–2009 MISR imagery of Borneo." ACP 12, 3437–3454.** https://acp.copernicus.org/articles/12/3437/2012/ Mean plume length 41 km and height 708 m (interquartile 523 to 993 m). Mean width is 27% of length. Surface winds were 3 to 4 m/s from the southeast.
- Marlier et al. (2015) inject all fire emissions in the boundary layer.

Inference: model peat smoke as a well-mixed boundary-layer tracer (0 to about 1.5 km by day, collapsing at night). Use the 925 hPa wind, or the mean of 10 m and 850 hPa, as the steering wind. Smouldering peat has almost no buoyant rise.

### 4.4 Removal

Established, qualitatively:
- Rain scavenging is a key aerosol sink over the Maritime Continent. Monsoon winds and rainfall modulate both transport and scavenging (ACP 20, 2387, 2020; WRF smoke studies).
- In 2006, low precipitation in the El Nino likely lengthened smoke lifetimes and increased transport (Marlier et al. 2015).
- MetMalaysia expected the inter-monsoon rain and wind shift to "wash away" the 2026 haze.

Not found as a regional figure: a smoke e-folding lifetime. Inference from general aerosol knowledge (e.g. AeroCom black carbon lifetimes of about 4 to 7 days; not re-verified this session):
- Use tau_dry of about 4 to 5 days with no rain on the path.
- Apply a scavenging factor exp(-Lambda * P) per hour, where P is precipitation in mm/h along the path and Lambda is about 0.3 to 1 per mm as a tunable starting value.
- For Riau to KL (under a day) removal hardly matters unless it rains on the path. For Kalimantan to KL (2 to 4 days) it matters a lot.

### 4.5 How distance and wind alignment scale contribution (inference, physics)

In a boundary layer of depth h, with mean wind u, a steady source Q gives a downwind concentration of roughly:

C(x, y) ~ Q / (sqrt(2*pi) * sigma_y(x) * u * h) * exp(-y^2 / (2 * sigma_y^2)) * exp(-x / (u * tau))

- sigma_y grows roughly linearly with x at mesoscale, sigma_y ~ sigma_theta * x, where sigma_theta of about 0.15 to 0.35 rad stands for wind meander over hours to days.
- So **per unit emission, a perfectly aligned source decays roughly as 1/x times exp(-x / (u * tau))**.
- Worked example: Rupat at 120 km against OKI at 850 km, with u = 6 m/s and tau = 4 days, gives about 7 x exp(-0.35), roughly a **5x** higher sensitivity for Rupat. That holds only when the wind is aligned for each.
- Misalignment drops contribution as a Gaussian in the angle. With sigma_theta = 0.25 rad, a 30-degree miss cuts it about 3x and a 45-degree miss about 7x.
- The data in section 2 show emission volume plus how often the wind lines up can outweigh proximity (South Sumatra over central Sumatra for Singapore). For KL, though, proximity, alignment and volume all favour Riau and Jambi during June to September.

---

## 5. Local Malaysian fires against transboundary smoke

Established:
- **Peninsular Malaysia fires:**
  - 2 to 3% of Singapore's fire PM2.5 over 2004 to 2009, about 4% in La Nina years (Reddington et al. 2014).
  - More than 90% of Singapore's off-season haze in February to April 2014, and one of the top three contributors over 2010 to 2015 (Hansen et al. 2019).
- **Klang Valley in April 2016 (inter-monsoon):** the Natural Resources and Environment Minister attributed the haze to peat fires in Kuala Langat and Sepang, Selangor, with "no influence of transboundary haze". This is an official statement without apportionment. https://www.nst.com.my/news/2016/04/140867/klang-valley-haze-due-forest-peat-fires
- **Abdul Rahman, S., et al. (2015), Aerosol and Air Quality Research**, Klang Valley 2002 to 2011: smoke transboundary events were identified from fine potassium in 2004, 2006 and 2008. The **primary source of PM2.5 on haze days was still local, mainly vehicles (about 35%)**. https://aaqr.org/articles/aaqr-15-03-siiac-0188
- **Amil et al. (2016):** mixed SIA plus biomass burning is 42% of annual PM2.5 in Petaling Jaya. That factor is not purely transboundary.
- **Murulitharan (2025):** Sumatran emissions correlated with Greater KL PM2.5 only in the large episode of September 2019. Other years correlated weakly.
- **Sarawak in 2026:** ASMC counted 7,286 hotspots in Kalimantan and 148 in Sarawak between 1 and 19 August. Haze in western Sarawak was attributed to West Kalimantan, with a local contribution acknowledged.

Inference:
- **In an SW-monsoon transboundary episode, local Peninsular fires are a small share of the fire component of KL PM2.5.** By analogy with Reddington's 2 to 4% for Singapore, plus hotspot counts, I would guess under 10%.
- Per hotspot, however, they are very potent because they are close. A Kuala Langat peat fire 30 to 40 km from KL needs only a light wind to arrive and has almost no time to dilute.
- In the inter-monsoon (now) and in February to March, when Sumatran transport is weak or variable, local fires and urban emissions can dominate.
- A KL product should therefore score Malaysian hotspots on the same footing as Indonesian ones, not exclude them. A distance-aware score will naturally rank a Kuala Langat or Pahang peat fire highly per unit emission.

---

## 6. Counterfactual results ("suppress X in Y, receptor drops Z")

Established:

| Study | Intervention | Receptor result |
|---|---|---|
| Marlier et al. 2019 | Block all peatland fires (-65% emissions) | Malaysia exposure -71%, deaths -73% (2,400 to 630 per year) |
| Marlier et al. 2019 | Block all concession fires (-39%) | Malaysia exposure -60% |
| Marlier et al. 2019 | Block conservation-area fires (-24%) | Malaysia exposure -9% |
| Marlier et al. 2019 | Restore BRG sites (-39%) | Malaysia exposure -24%, Singapore -47% |
| Marlier et al. 2015 | Peatland protection, 2010 to 2030 (-59%) | Singapore -70%, Palembang -40%, region -60% |
| Kim et al. 2015 | Peat Protection against High Oil Palm | Singapore smoke divided by 4, region by 2 |
| Koplitz et al. 2016 | (attribution) South Sumatra: more than 30% of emissions | More than 50% of regional exposure, 2006 and 2015 |
| Reddington et al. 2014 | Switch off central Sumatra | KL fire PM2.5 -69 to 74% (2004 to 2009 mean) |
| Murulitharan 2024/2025 | Switch off Riau | About -50 to 59% of modelled fire PM2.5 at Klang, Kuala Selangor and Bangi (September 2019) |
| Murulitharan 2024/2025 | Switch off Jambi | About -51 to 58% at Petaling Jaya, Cheras, Batu Muda and Putrajaya |

All the source-receptor relationships are linear (Koplitz et al. 2016; Marlier et al. 2019), so a share is the reduction you get from removing that source entirely. Removing a fraction f of a source's emissions removes f times its share.

Near against far, per unit emission. Established: Kim et al. (2015) and Marlier et al. (2015) give Sumatra about 2.4x (regional) to about 4x (Singapore) the per-unit-emission impact of Kalimantan. Inference for KL: by geometry and the Reddington and Murulitharan shares, Riau and Jambi probably carry about 5 to 20x the per-unit-emission impact of Kalimantan for KL. The point to rank on is therefore **contribution = sensitivity x emission**, not raw fire size or raw proximity.

---

## 7. Sources consulted (not all quoted above)

- Reddington et al. 2014, ERL. https://doi.org/10.1088/1748-9326/9/9/094006
- Kim et al. 2015, Atmospheric Environment. https://doi.org/10.1016/j.atmosenv.2014.09.045
- Koplitz et al. 2016, ERL. https://doi.org/10.1088/1748-9326/11/9/094023
- Marlier et al. 2015, ERL 10, 054010. https://doi.org/10.1088/1748-9326/10/5/054010
- Marlier et al. 2019, GeoHealth. https://doi.org/10.1029/2019GH000191
- Hansen et al. 2019, ACP. https://doi.org/10.5194/acp-19-5363-2019
- Murulitharan et al. 2024, EGU24-8954; Murulitharan 2025, Cambridge PhD. doi:10.17863/CAM.117887
- Kiely et al. 2019, ACP; 2020, ERL; 2021, Nature Communications (DOIs above)
- Crippa et al. 2016, Scientific Reports; Mead et al. 2018, ERL; Aouizerats et al. 2015, ACP; Lee et al. 2018, ACP
- Amil et al. 2016, ACP; Abdul Rahman et al. 2015, AAQR; Latif et al. 2018, "Impact of regional haze towards air quality in Malaysia: A review," Atmospheric Environment 177, 28–44
- Tosca et al. 2011, JGR; Zender et al. 2012, ACP; Hu et al. 2018, IJWF
- Kusumaningtyas and Aldrian 2016, ERL; Koe et al. 2001, Atmospheric Environment
- Reid et al. 2012, "Multi-scale meteorological conceptual analysis of observed active fire hotspot activity and smoke optical depth in the Maritime Continent," ACP 12, 2117. https://acp.copernicus.org/articles/12/2117/2012/
- ASMC alerts and reviews; MetMalaysia statements via The Star, 6 October 2026; Malay Mail, 8 October 2026

---

## 8. Proposal: per-hotspot influence score on a receptor (inference)

**Goal:** for each active hotspot i and each receptor r (KL, Putrajaya, Shah Alam/Klang, Seremban, optionally population-weighted), estimate the expected PM2.5 at r over the next 72 h that suppressing i would avoid, in ug/m3 x h or a relative index.

### 8.1 Preferred: backward footprint (adjoint analogue)

For each receptor r and each forecast hour t over the next 72 h:
1. Release N particles (about 200 to 500) at r, spread over 0 to h_mix(t), and integrate them **backwards** for 96 to 120 h using the hourly wind from the reanalysis or forecast archive. Use the boundary-layer mean wind (925 hPa, or the mean of 10 m and 850 hPa). Add a random-walk term with a horizontal velocity sigma of about 1 to 2 m/s, or a turbulent diffusivity of about 1e4 to 5e4 m2/s.
2. Each particle carries a weight w = exp(-age / tau_dry) * exp(-Lambda * sum of P along its path). P is hourly precipitation sampled along the path.
3. Accumulate the residence time of particles below h_mix in a 0.1 or 0.25 degree grid. That gives the footprint F_r,t(cell) in s/m when divided by h_mix.

Then, for each hotspot:

S_i,r = sum over t and age of F_r,t(cell_i, age) / (A_cell)  [concentration per unit emission rate]

E_i = FRP_i * beta(landcover_i) * persistence_i

Influence_i,r = S_i,r * E_i

- beta converts FRP to PM2.5. Use GFAS-style conversion factors, with peat about 2 to 5x higher per unit FRP than surface vegetation (Kiely et al. 2019: peat is 71% of PM and FRP underestimates smouldering).
- persistence is the expected remaining burn duration. Peat fires persist for days; use detection history at the same pixel (repeat detections over the last 3 to 7 days).
- Priority = Influence_i,r, optionally weighted by receptor population and summed over receptors.
- Also report the per-unit-emission S_i,r, so users can see "this fire is small but perfectly placed."

Cost: 4 receptors x 72 hourly releases x 300 particles x about 400 steps of 15 min is about 35 million particle steps per hourly cycle. That runs in seconds in TypeScript, or as a numpy job. The backward method costs the same whether there are 50 or 5,000 hotspots.

### 8.2 Fallback: closed-form plume-sector score (no trajectories)

For hotspot i, using the transport-weighted mean wind vector U (speed u, direction of travel theta_w), averaged over the expected transit window from the hourly forecast:
- d = great-circle distance, phi = bearing from source to receptor, delta = angle(phi - theta_w)
- x = d * cos(delta) (downwind), y = d * sin(delta) (crosswind); score 0 if x <= 0
- sigma_y = sigma0 + sigma_theta * x, with sigma0 about 5 km and sigma_theta about 0.25 rad
- T = x / u (transit time)
- G_i,r = exp(-y^2 / (2 * sigma_y^2)) / (sqrt(2*pi) * sigma_y * u * h_mix) * exp(-T / tau_dry) * exp(-Lambda * P_path)
- Influence_i,r = E_i * G_i,r

Use it only for d < about 300 km (Riau coast, Malaysian fires). Beyond that the cross-equatorial recurvature makes straight lines wrong. For Jambi, South Sumatra and Kalimantan, use at least a single deterministic trajectory per hotspot per forecast hour: forward from the hotspot, scoring the minimum miss distance to r, with the same Gaussian and decay.

### 8.3 Calibration and validation

The project already stores DOE readings, fire detections and weather hours.
- Define observed smoke at each station as PM2.5 minus a non-episode baseline. Kim et al. used the bracketing non-burning months; a rolling 30-day 10th percentile also works.
- Regress smoke on sum over i of Influence_i,r, lagged as the trajectories imply, to fit one scale factor k per receptor, and possibly beta_peat.
- Targets for skill: Murulitharan reached r = 0.62 to 0.70 with NAME + GFAS in September 2019. Kim et al. reached spatial r = 0.84.
- Backtest on the stored week, and on September 2019 and October 2023 if those hotspot and wind archives exist.

### 8.4 Caveats to show users

- Meteorology dominates. One wind shift (for example the inter-monsoon from 9 October 2026) reorders the ranking, so rankings are valid for a forecast window, not a season.
- Fire PM is underestimated, by a factor of about 2 to 5 in models and up to 3.5x for peat in inventories. The absolute ug/m3 is uncertain, but the ranking is more robust.
- Satellite hotspots miss smouldering peat under smoke or cloud and often detect the same fire repeatedly. FRP is a poor proxy for peat emissions.
- Linearity is fine for primary smoke. Secondary aerosol and the urban background (about 28 ug/m3 annual in the Klang Valley) are outside the score.
- Station-level differences are real: about 30 km within the Klang Valley changes the Riau to Jambi split.
- "Suppress" assumes suppression actually stops emissions. Smouldering peat often reignites, which is why the persistence term matters.

---

## 9. Gaps (not verified this session)

- Malaysia-specific province shares in Koplitz et al. (2016), which are only in Figure 3 and supplementary Figure S3.
- The BRG site ranking for the Malaysia receptor in Marlier et al. (2019), supplementary Figure S6.
- An 850 hPa wind climatology for the Straits in figures.
- A regional smoke lifetime or wet-scavenging rate.
- A peer-reviewed local-against-transboundary apportionment for Kuala Langat or Selangor peat.
- The original texts of Koe et al. (2001) and Lawrence et al. (2001), and Mead et al. (2018) source tagging.
- Whether a recent 2023 to 2026 trajectory study of KL exists. The search budget ran out before I could check.
