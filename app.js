// 차대자 (ChaDaeJa) 순수 바닐라 JavaScript 애플리케이션
// 빌드 과정 없이 브라우저에서 직접 실행됩니다.

(function () {
  const DATA = window.CHADAEJA_DATA;
  if (!DATA) return;

  // --- 상태 (State) ---
  const state = {
    districts: DATA.DISTRICTS,
    selectedDistrict: DATA.DISTRICTS[0],
    hotspots: DATA.INITIAL_HOTSPOTS.slice(),
    parkings: DATA.ALTERNATIVE_PARKINGS.slice(),
    selectedHotspot: null,
    selectedParking: null,
    mapEngine: 'GOOGLE_EMBED', // 'GOOGLE_EMBED' | 'LEAFLET'
    googleMapType: 'k', // 'k' (위성) | 'm' (일반)
    leafletFilterMode: 'ALL', // 'ALL' | 'HOTSPOTS_ONLY' | 'PARKINGS_ONLY'
    activeTab: 'SPLIT', // 'SPLIT' | 'MAP' | 'HOTSPOTS' | 'PARKINGS'
    hotspotSearch: '',
    hotspotTypeFilter: 'ALL',
    hotspotSeverityFilter: 'ALL',
    parkingFilterType: 'ALL',
    parkingSortBy: 'DISTANCE',
    carType: 'STANDARD', // 'STANDARD' | 'COMPACT' | 'ECO' | 'MULTI_CHILD'
    copiedParkingId: null,
    isLocating: false,
    photoPreviewDataUrl: null,
  };

  // Leaflet 내부 객체
  let leafletMap = null;
  let leafletHotspotMarkers = [];
  let leafletParkingMarkers = [];
  let leafletRouteLine = null;
  let leafletRouteBadge = null;

  // --- 유틸리티 ---
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getDistrictHotspots() {
    return state.hotspots.filter((h) => h.district === state.selectedDistrict.id);
  }

  function getDistrictParkings() {
    return state.parkings.filter((p) => p.district === state.selectedDistrict.id);
  }

  function getDiscountedRate(baseRate) {
    if (baseRate === 0) return 0;
    if (
      state.carType === 'COMPACT' ||
      state.carType === 'ECO' ||
      state.carType === 'MULTI_CHILD'
    ) {
      return Math.round(baseRate * 0.5);
    }
    return baseRate;
  }

  function getGoogleEmbedUrl() {
    if (state.selectedParking) {
      return (
        'https://maps.google.com/maps?q=' +
        state.selectedParking.lat +
        ',' +
        state.selectedParking.lng +
        '&hl=ko&t=' +
        state.googleMapType +
        '&z=17&output=embed'
      );
    }
    if (state.selectedHotspot) {
      return (
        'https://maps.google.com/maps?q=' +
        state.selectedHotspot.lat +
        ',' +
        state.selectedHotspot.lng +
        '&hl=ko&t=' +
        state.googleMapType +
        '&z=17&output=embed'
      );
    }
    if (state.selectedDistrict.id === 'dasa' && state.googleMapType === 'k') {
      return DATA.DASA_ORIGINAL_EMBED_URL;
    }
    return (
      'https://maps.google.com/maps?q=' +
      encodeURIComponent(state.selectedDistrict.fullName) +
      '&hl=ko&t=' +
      state.googleMapType +
      '&z=15&output=embed'
    );
  }

  // --- DOM 참조 ---
  const els = {};

  function cacheElements() {
    els.districtSelect = document.getElementById('districtSelect');
    els.locateBtn = document.getElementById('locateBtn');
    els.locateDot = document.getElementById('locateDot');
    els.locateText = document.getElementById('locateText');
    els.bannerDistrictName = document.getElementById('bannerDistrictName');
    els.bannerDistrictDesc = document.getElementById('bannerDistrictDesc');
    els.metricHotspots = document.getElementById('metricHotspots');
    els.metricSpots = document.getElementById('metricSpots');
    els.tabCountHotspots = document.getElementById('tabCountHotspots');
    els.tabCountParkings = document.getElementById('tabCountParkings');
    els.tabButtons = document.querySelectorAll('[data-tab]');

    els.mainGrid = document.getElementById('mainGrid');
    els.mapColumn = document.getElementById('mapColumn');
    els.cardsColumn = document.getElementById('cardsColumn');
    els.hotspotPanelWrap = document.getElementById('hotspotPanelWrap');
    els.parkingPanelWrap = document.getElementById('parkingPanelWrap');

    els.btnEngineGoogle = document.getElementById('btnEngineGoogle');
    els.btnEngineLeaflet = document.getElementById('btnEngineLeaflet');
    els.googleSubControls = document.getElementById('googleSubControls');
    els.leafletSubControls = document.getElementById('leafletSubControls');
    els.btnGoogleSat = document.getElementById('btnGoogleSat');
    els.btnGoogleRoad = document.getElementById('btnGoogleRoad');
    els.btnGoogleReset = document.getElementById('btnGoogleReset');
    els.googleIframeWrap = document.getElementById('googleIframeWrap');
    els.googleIframe = document.getElementById('googleIframe');
    els.googleStatusLabel = document.getElementById('googleStatusLabel');
    els.btnSwitchToLeafletInline = document.getElementById('btnSwitchToLeafletInline');
    els.leafletWrap = document.getElementById('leafletWrap');
    els.leafletMapBox = document.getElementById('leafletMapBox');
    els.mapGuidanceCard = document.getElementById('mapGuidanceCard');

    els.leafletFilterBtns = document.querySelectorAll('[data-leaflet-filter]');
    els.leafletCountHotspots = document.getElementById('leafletCountHotspots');
    els.leafletCountParkings = document.getElementById('leafletCountParkings');

    els.hotspotSearchInput = document.getElementById('hotspotSearchInput');
    els.hotspotTypeSelect = document.getElementById('hotspotTypeSelect');
    els.hotspotSeveritySelect = document.getElementById('hotspotSeveritySelect');
    els.hotspotList = document.getElementById('hotspotList');

    els.totalAvailablePill = document.getElementById('totalAvailablePill');
    els.carTypeBtns = document.querySelectorAll('[data-car-type]');
    els.parkingFilterBtns = document.querySelectorAll('[data-parking-filter]');
    els.parkingSortSelect = document.getElementById('parkingSortSelect');
    els.parkingCountAll = document.getElementById('parkingCountAll');
    els.parkingList = document.getElementById('parkingList');

    // Modals
    els.reportModal = document.getElementById('reportModal');
    els.impactModal = document.getElementById('impactModal');
    els.safetyModal = document.getElementById('safetyModal');
    els.reportForm = document.getElementById('reportForm');
    els.reportSuccessBox = document.getElementById('reportSuccessBox');
    els.reportDistrictLabel = document.getElementById('reportDistrictLabel');
    els.reportViolationType = document.getElementById('reportViolationType');
    els.reportLocationName = document.getElementById('reportLocationName');
    els.reportAddress = document.getElementById('reportAddress');
    els.reportDescription = document.getElementById('reportDescription');
    els.reportPhotoInput = document.getElementById('reportPhotoInput');
    els.reportPhotoStatus = document.getElementById('reportPhotoStatus');
  }

  // --- 렌더링 함수들 ---
  function renderDistrictOptions() {
    els.districtSelect.innerHTML = state.districts
      .map(
        (d) =>
          `<option value="${escapeHtml(d.id)}" ${
            d.id === state.selectedDistrict.id ? 'selected' : ''
          }>${escapeHtml(d.name)}</option>`
      )
      .join('');
  }

  function renderBannerAndMetrics() {
    const dHotspots = getDistrictHotspots();
    const dParkings = getDistrictParkings();
    const totalSpots = dParkings.reduce((sum, p) => sum + p.availableSpots, 0);

    els.bannerDistrictName.textContent = `[${state.selectedDistrict.name}]`;
    els.bannerDistrictDesc.textContent = state.selectedDistrict.description;
    els.metricHotspots.textContent = `${dHotspots.length}개소`;
    els.metricSpots.textContent = `${totalSpots}면`;

    els.tabCountHotspots.textContent = dHotspots.length;
    els.tabCountParkings.textContent = dParkings.length;
    els.leafletCountHotspots.textContent = dHotspots.length;
    els.leafletCountParkings.textContent = dParkings.length;
    els.parkingCountAll.textContent = dParkings.length;
    els.totalAvailablePill.textContent = `총 ${totalSpots}면 즉시 주차 가능`;
    els.reportDistrictLabel.textContent = `${state.selectedDistrict.name} 일대 반복되는 주차 문제를 데이터로 기록합니다.`;
  }

  function renderLayoutTab() {
    els.tabButtons.forEach((btn) => {
      const tab = btn.getAttribute('data-tab');
      btn.classList.remove('active-dark', 'active-red', 'active-emerald');
      if (tab === state.activeTab) {
        if (tab === 'HOTSPOTS') btn.classList.add('active-red');
        else if (tab === 'PARKINGS') btn.classList.add('active-emerald');
        else btn.classList.add('active-dark');
      }
    });

    els.mainGrid.className = 'split-grid';
    els.mapColumn.classList.remove('hidden', 'full-height');
    els.cardsColumn.classList.remove('hidden', 'single-column');
    els.hotspotPanelWrap.classList.remove('hidden');
    els.parkingPanelWrap.classList.remove('hidden');

    if (state.activeTab === 'MAP') {
      els.mainGrid.className = '';
      els.mapColumn.classList.add('full-height');
      els.cardsColumn.classList.add('hidden');
    } else if (state.activeTab === 'HOTSPOTS') {
      els.mainGrid.className = '';
      els.mapColumn.classList.add('hidden');
      els.cardsColumn.classList.add('single-column');
      els.parkingPanelWrap.classList.add('hidden');
    } else if (state.activeTab === 'PARKINGS') {
      els.mainGrid.className = '';
      els.mapColumn.classList.add('hidden');
      els.cardsColumn.classList.add('single-column');
      els.hotspotPanelWrap.classList.add('hidden');
    }

    if (state.mapEngine === 'LEAFLET' && leafletMap) {
      setTimeout(() => {
        leafletMap.invalidateSize();
      }, 60);
    }
  }

  function renderMap() {
    if (state.mapEngine === 'GOOGLE_EMBED') {
      els.btnEngineGoogle.classList.add('active-google');
      els.btnEngineLeaflet.classList.remove('active-leaflet');
      els.googleSubControls.classList.remove('hidden');
      els.leafletSubControls.classList.add('hidden');
      els.googleIframeWrap.classList.remove('hidden');
      els.leafletWrap.classList.add('hidden');

      els.btnGoogleSat.classList.toggle('active', state.googleMapType === 'k');
      els.btnGoogleRoad.classList.toggle('active', state.googleMapType === 'm');
      els.btnGoogleReset.classList.toggle(
        'hidden',
        !(state.selectedHotspot || state.selectedParking)
      );

      const nextUrl = getGoogleEmbedUrl();
      if (els.googleIframe.getAttribute('src') !== nextUrl) {
        els.googleIframe.setAttribute('src', nextUrl);
      }

      if (state.selectedParking) {
        els.googleStatusLabel.textContent = `선택된 주차장: ${state.selectedParking.name}`;
      } else if (state.selectedHotspot) {
        els.googleStatusLabel.textContent = `선택된 상습구역: ${state.selectedHotspot.name}`;
      } else {
        els.googleStatusLabel.textContent = state.selectedDistrict.fullName;
      }
    } else {
      els.btnEngineGoogle.classList.remove('active-google');
      els.btnEngineLeaflet.classList.add('active-leaflet');
      els.googleSubControls.classList.add('hidden');
      els.leafletSubControls.classList.remove('hidden');
      els.googleIframeWrap.classList.add('hidden');
      els.leafletWrap.classList.remove('hidden');

      els.leafletFilterBtns.forEach((btn) => {
        const mode = btn.getAttribute('data-leaflet-filter');
        btn.classList.remove('active', 'active-red', 'active-emerald');
        if (mode === state.leafletFilterMode) {
          if (mode === 'HOTSPOTS_ONLY') btn.classList.add('active-red');
          else if (mode === 'PARKINGS_ONLY') btn.classList.add('active-emerald');
          else btn.classList.add('active');
        }
      });

      initOrUpdateLeaflet();
    }

    renderMapGuidanceCard();
  }

  function renderMapGuidanceCard() {
    const spot = state.selectedHotspot;
    if (!spot) {
      els.mapGuidanceCard.classList.add('hidden');
      els.mapGuidanceCard.innerHTML = '';
      return;
    }

    const info =
      DATA.VIOLATION_INFO[spot.violationType] || DATA.VIOLATION_INFO.DOUBLE_PARKING;
    const dParkings = getDistrictParkings();
    const nearest = dParkings.find((p) => p.id === spot.nearestParkingId);

    els.mapGuidanceCard.classList.remove('hidden');
    els.mapGuidanceCard.innerHTML = `
      <div class="guidance-top">
        <div>
          <div class="badge-group" style="margin-bottom:4px;">
            <span class="pill-soft rose">${escapeHtml(info.label)}</span>
            <span style="font-size:10px;color:#64748b;font-weight:600;">월 상습 ${spot.repeatCount}건</span>
          </div>
          <h4 class="item-title" style="margin:0;">${escapeHtml(spot.name)}</h4>
        </div>
        <button type="button" id="closeGuidanceBtn" class="guidance-close" aria-label="닫기">✕</button>
      </div>
      <p style="font-size:12px;color:#475569;margin:4px 0 6px;">⚠️ ${escapeHtml(spot.impactNote)}</p>
      ${
        nearest
          ? `
        <div class="guidance-match">
          <div class="guidance-match-row">
            <strong style="color:#064e3b;">● 추천 대안: ${escapeHtml(nearest.name)}</strong>
            <span style="color:#047857;font-weight:700;white-space:nowrap;">도보 ${nearest.walkingMinutes}분 (${nearest.distanceMeters}m)</span>
          </div>
          <div class="guidance-match-footer">
            <span style="color:#475569;">여유 ${nearest.availableSpots}면 · ${
              nearest.hourlyRate === 0
                ? '무료'
                : `${nearest.hourlyRate.toLocaleString()}원/h`
            }</span>
            <button type="button" id="guidanceNavigateBtn" class="btn-emerald">대안 주차 길안내</button>
          </div>
        </div>
      `
          : ''
      }
    `;

    const closeBtn = document.getElementById('closeGuidanceBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        state.selectedHotspot = null;
        renderAll();
      });
    }

    const navBtn = document.getElementById('guidanceNavigateBtn');
    if (navBtn && nearest) {
      navBtn.addEventListener('click', () => {
        state.selectedParking = nearest;
        renderAll();
      });
    }
  }

  function initOrUpdateLeaflet() {
    if (typeof window.L === 'undefined') return;
    const L = window.L;

    if (!leafletMap) {
      leafletMap = L.map(els.leafletMapBox, {
        center: [state.selectedDistrict.centerLat, state.selectedDistrict.centerLng],
        zoom: 15,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
          subdomains: 'abcd',
        }
      ).addTo(leafletMap);
    }

    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize();
    }, 50);

    // Clear existing markers & routes
    leafletHotspotMarkers.forEach((m) => m.remove());
    leafletParkingMarkers.forEach((m) => m.remove());
    leafletHotspotMarkers = [];
    leafletParkingMarkers = [];
    if (leafletRouteLine) {
      leafletRouteLine.remove();
      leafletRouteLine = null;
    }
    if (leafletRouteBadge) {
      leafletRouteBadge.remove();
      leafletRouteBadge = null;
    }

    const dHotspots = getDistrictHotspots();
    const dParkings = getDistrictParkings();

    if (
      state.leafletFilterMode === 'ALL' ||
      state.leafletFilterMode === 'HOTSPOTS_ONLY'
    ) {
      dHotspots.forEach((spot) => {
        const info =
          DATA.VIOLATION_INFO[spot.violationType] ||
          DATA.VIOLATION_INFO.DOUBLE_PARKING;
        const isSelected = state.selectedHotspot && state.selectedHotspot.id === spot.id;
        const html = `
          <div class="pin-hotspot-wrap">
            <div class="pin-hotspot-circle ${isSelected ? 'selected' : ''}" style="background:${info.markerBg};">!</div>
            <div class="pin-label">상습 ${spot.repeatCount}건</div>
          </div>
        `;
        const marker = L.marker([spot.lat, spot.lng], {
          icon: L.divIcon({
            html,
            className: '',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
        }).addTo(leafletMap);

        marker.on('click', () => selectHotspot(spot));
        leafletHotspotMarkers.push(marker);
      });
    }

    if (
      state.leafletFilterMode === 'ALL' ||
      state.leafletFilterMode === 'PARKINGS_ONLY'
    ) {
      dParkings.forEach((park) => {
        const isSelected = state.selectedParking && state.selectedParking.id === park.id;
        const isFree = park.hourlyRate === 0 || park.nightFree;
        const bg = isSelected ? '#047857' : isFree ? '#0284c7' : '#059669';
        const html = `
          <div class="pin-hotspot-wrap">
            <div class="pin-parking-pill" style="background:${bg};${
          isSelected ? 'border-color:#fde047;transform:scale(1.1);' : ''
        }">
              <span>P</span>
              <span>${park.availableSpots}면</span>
            </div>
            <div class="pin-label" style="background:${
              isFree ? '#0c4a6e' : '#0f172a'
            };">${isFree ? '야간무료/나눔' : park.hourlyRate.toLocaleString() + '원/h'}</div>
          </div>
        `;
        const marker = L.marker([park.lat, park.lng], {
          icon: L.divIcon({
            html,
            className: '',
            iconSize: [54, 28],
            iconAnchor: [27, 14],
          }),
        }).addTo(leafletMap);

        marker.on('click', () => {
          state.selectedParking = park;
          renderAll();
        });
        leafletParkingMarkers.push(marker);
      });
    }

    const targetParking =
      state.selectedParking ||
      (state.selectedHotspot
        ? dParkings.find((p) => p.id === state.selectedHotspot.nearestParkingId)
        : null);

    if (state.selectedHotspot && targetParking) {
      const latlngs = [
        [state.selectedHotspot.lat, state.selectedHotspot.lng],
        [targetParking.lat, targetParking.lng],
      ];
      leafletRouteLine = L.polyline(latlngs, {
        color: '#10b981',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
      }).addTo(leafletMap);

      const midLat = (state.selectedHotspot.lat + targetParking.lat) / 2;
      const midLng = (state.selectedHotspot.lng + targetParking.lng) / 2;
      leafletRouteBadge = L.marker([midLat, midLng], {
        icon: L.divIcon({
          html: `<div class="route-badge">도보 ${targetParking.walkingMinutes}분 (${targetParking.distanceMeters}m)</div>`,
          className: '',
          iconSize: [110, 24],
          iconAnchor: [55, 12],
        }),
      }).addTo(leafletMap);

      leafletMap.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60], maxZoom: 17 });
    } else if (state.selectedHotspot) {
      leafletMap.setView([state.selectedHotspot.lat, state.selectedHotspot.lng], 16, {
        animate: true,
      });
    } else if (state.selectedParking) {
      leafletMap.setView([state.selectedParking.lat, state.selectedParking.lng], 16, {
        animate: true,
      });
    } else {
      leafletMap.setView(
        [state.selectedDistrict.centerLat, state.selectedDistrict.centerLng],
        15,
        { animate: true }
      );
    }
  }

  function renderHotspots() {
    const dHotspots = getDistrictHotspots();
    const dParkings = getDistrictParkings();
    const q = state.hotspotSearch.trim().toLowerCase();

    const filtered = dHotspots.filter((spot) => {
      const matchSearch =
        !q ||
        spot.name.toLowerCase().includes(q) ||
        spot.address.toLowerCase().includes(q) ||
        spot.description.toLowerCase().includes(q);
      const matchType =
        state.hotspotTypeFilter === 'ALL' ||
        spot.violationType === state.hotspotTypeFilter;
      const matchSeverity =
        state.hotspotSeverityFilter === 'ALL' ||
        spot.severity === state.hotspotSeverityFilter;
      return matchSearch && matchType && matchSeverity;
    });

    if (filtered.length === 0) {
      els.hotspotList.innerHTML = `
        <div class="empty-state">
          <p>검색 조건에 맞는 상습 구역이 없습니다.</p>
          <button type="button" id="resetHotspotFilterBtn" style="margin-top:8px;color:#dc2626;font-weight:700;text-decoration:underline;">필터 초기화</button>
        </div>
      `;
      const resetBtn = document.getElementById('resetHotspotFilterBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state.hotspotSearch = '';
          state.hotspotTypeFilter = 'ALL';
          state.hotspotSeverityFilter = 'ALL';
          els.hotspotSearchInput.value = '';
          els.hotspotTypeSelect.value = 'ALL';
          els.hotspotSeveritySelect.value = 'ALL';
          renderHotspots();
        });
      }
      return;
    }

    els.hotspotList.innerHTML = filtered
      .map((spot) => {
        const isSelected = state.selectedHotspot && state.selectedHotspot.id === spot.id;
        const info =
          DATA.VIOLATION_INFO[spot.violationType] ||
          DATA.VIOLATION_INFO.DOUBLE_PARKING;
        const matchedParking = dParkings.find((p) => p.id === spot.nearestParkingId);

        return `
          <article class="item-card ${isSelected ? 'selected-red' : ''}" data-hotspot-id="${escapeHtml(spot.id)}">
            <div class="card-top">
              <div class="badge-group">
                <span style="font-size:15px;">${info.icon}</span>
                <span class="pill-badge" style="background:${info.badgeBg};">${escapeHtml(info.label)}</span>
                ${
                  spot.severity === 'CRITICAL'
                    ? '<span class="pill-soft rose">위험도 심각</span>'
                    : ''
                }
              </div>
              <span class="repeat-badge">월 상습 ${spot.repeatCount}건</span>
            </div>

            <h4 class="item-title">${escapeHtml(spot.name)}</h4>
            <p class="item-address">📍 ${escapeHtml(spot.address)}</p>

            <div class="info-box">
              <div>🕒 상습 발생 시간: <strong>${escapeHtml(spot.peakHours)}</strong></div>
              <p>${escapeHtml(spot.description)}</p>
            </div>

            <div class="impact-box">
              <strong>⚠️ 이웃 피해:</strong> ${escapeHtml(spot.impactNote)}
            </div>

            ${
              matchedParking
                ? `
              <div class="nudge-box">
                <div>
                  <div style="font-size:11px;font-weight:800;color:#064e3b;">
                    ● 이곳 대신 주차할 곳
                    <span class="pill-soft emerald" style="margin-left:4px;">도보 ${matchedParking.walkingMinutes}분 (${matchedParking.distanceMeters}m)</span>
                  </div>
                  <div style="font-size:12px;font-weight:700;color:#1e293b;margin-top:3px;">${escapeHtml(matchedParking.name)}</div>
                  <div style="font-size:11px;color:#64748b;">여유 ${matchedParking.availableSpots}면 · ${
                    matchedParking.hourlyRate === 0
                      ? '무료'
                      : `${matchedParking.hourlyRate.toLocaleString()}원/h`
                  }</div>
                </div>
                <button type="button" class="btn-emerald" data-select-alt-id="${escapeHtml(matchedParking.id)}">대안 주차 확인 →</button>
              </div>
            `
                : ''
            }

            <div class="card-footer-meta">
              <span>💬 시민 실시간 제보 ${spot.reports.length + spot.reportedToday}건</span>
              <span>지도에서 위치 보기 →</span>
            </div>
          </article>
        `;
      })
      .join('');

    els.hotspotList.querySelectorAll('[data-hotspot-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-hotspot-id');
        const found = dHotspots.find((s) => s.id === id);
        if (found) selectHotspot(found);
      });
    });

    els.hotspotList.querySelectorAll('[data-select-alt-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute('data-select-alt-id');
        const park = dParkings.find((p) => p.id === pid);
        if (park) {
          state.selectedParking = park;
          state.activeTab = 'SPLIT';
          renderAll();
        }
      });
    });
  }

  function renderParkings() {
    els.carTypeBtns.forEach((btn) => {
      const type = btn.getAttribute('data-car-type');
      btn.classList.remove('active-dark', 'active-amber', 'active-emerald', 'active-purple');
      if (type === state.carType) {
        if (type === 'COMPACT') btn.classList.add('active-amber');
        else if (type === 'ECO') btn.classList.add('active-emerald');
        else if (type === 'MULTI_CHILD') btn.classList.add('active-purple');
        else btn.classList.add('active-dark');
      }
    });

    els.parkingFilterBtns.forEach((btn) => {
      const f = btn.getAttribute('data-parking-filter');
      btn.classList.remove('active-dark', 'active-sky', 'active-emerald');
      if (f === state.parkingFilterType) {
        if (f === 'FREE') btn.classList.add('active-sky');
        else if (f === 'PUBLIC') btn.classList.add('active-emerald');
        else btn.classList.add('active-dark');
      }
    });

    const dParkings = getDistrictParkings()
      .filter((p) => {
        if (state.parkingFilterType === 'FREE') return p.hourlyRate === 0 || p.nightFree;
        if (state.parkingFilterType === 'PUBLIC') return p.type === 'PUBLIC';
        return true;
      })
      .sort((a, b) => {
        if (state.parkingSortBy === 'DISTANCE') return a.distanceMeters - b.distanceMeters;
        if (state.parkingSortBy === 'PRICE') {
          return getDiscountedRate(a.hourlyRate) - getDiscountedRate(b.hourlyRate);
        }
        if (state.parkingSortBy === 'SPOTS') return b.availableSpots - a.availableSpots;
        return 0;
      });

    els.parkingList.innerHTML = dParkings
      .map((p) => {
        const isSelected = state.selectedParking && state.selectedParking.id === p.id;
        const discounted = getDiscountedRate(p.hourlyRate);

        return `
          <article class="item-card ${isSelected ? 'selected-emerald' : ''}" data-parking-id="${escapeHtml(p.id)}">
            <div class="card-top">
              <div class="badge-group">
                <span class="pill-badge" style="background:${p.hourlyRate === 0 ? '#0284c7' : '#059669'};">
                  ${p.hourlyRate === 0 ? '무료 개방' : '공영 주차'}
                </span>
                <span class="pill-soft emerald">도보 ${p.walkingMinutes}분 (${p.distanceMeters}m)</span>
                ${p.nightFree ? '<span class="pill-soft amber">야간 무료</span>' : ''}
              </div>
              <span class="spots-badge ${p.availableSpots > 10 ? 'high' : 'low'}">
                잔여 ${p.availableSpots} / ${p.totalSpots}면
              </span>
            </div>

            <h4 class="item-title">${escapeHtml(p.name)}</h4>
            <p class="item-address">📍 ${escapeHtml(p.address)}</p>

            <div class="info-box">
              <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                <span style="color:#64748b;">🕒 운영 시간</span>
                <strong style="font-size:11px;">${escapeHtml(p.operatingHours)}</strong>
              </div>
              <div class="rate-row">
                <span style="color:#64748b;">예상 요금 (시간당)</span>
                <div>
                  ${
                    p.hourlyRate === 0
                      ? '<span class="rate-final">완전 무료</span>'
                      : `
                        ${
                          discounted !== p.hourlyRate
                            ? `<span class="rate-strike">${p.hourlyRate.toLocaleString()}원</span>`
                            : ''
                        }
                        <span class="rate-final">${discounted.toLocaleString()}원</span>
                        <span style="font-size:10px;color:#94a3b8;">/시간</span>
                      `
                  }
                </div>
              </div>
              ${
                p.freeGraceMinutes > 0
                  ? `<p>✓ 입차 후 ${p.freeGraceMinutes}분 이내 회차 시 무료</p>`
                  : ''
              }
            </div>

            <div class="feature-tags">
              ${p.features
                .map((f) => `<span class="feature-tag">#${escapeHtml(f)}</span>`)
                .join('')}
            </div>

            <div class="nav-btn-row">
              <button type="button" class="btn-naver" data-nav-app="naver" data-nav-id="${escapeHtml(p.id)}">네이버 길찾기</button>
              <button type="button" class="btn-kakao" data-nav-app="kakao" data-nav-id="${escapeHtml(p.id)}">카카오 길찾기</button>
              <button type="button" class="btn-copy" data-copy-id="${escapeHtml(p.id)}">
                ${state.copiedParkingId === p.id ? '✓ 복사됨' : '주소복사'}
              </button>
            </div>
          </article>
        `;
      })
      .join('');

    els.parkingList.querySelectorAll('[data-parking-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-parking-id');
        const found = dParkings.find((p) => p.id === id);
        if (found) {
          state.selectedParking = found;
          if (state.activeTab !== 'SPLIT') state.activeTab = 'SPLIT';
          renderAll();
          window.scrollTo({ top: 100, behavior: 'smooth' });
        }
      });
    });

    els.parkingList.querySelectorAll('[data-nav-app]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const app = btn.getAttribute('data-nav-app');
        const id = btn.getAttribute('data-nav-id');
        const park = dParkings.find((p) => p.id === id);
        if (!park) return;
        const query = encodeURIComponent(park.navQuery || park.name);
        const url =
          app === 'naver'
            ? `https://map.naver.com/v5/search/${query}`
            : `https://map.kakao.com/link/to/${query},${park.lat},${park.lng}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    });

    els.parkingList.querySelectorAll('[data-copy-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-copy-id');
        const park = dParkings.find((p) => p.id === id);
        if (!park) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(park.address).catch(() => {});
        }
        state.copiedParkingId = id;
        renderParkings();
        setTimeout(() => {
          state.copiedParkingId = null;
          renderParkings();
        }, 1800);
      });
    });
  }

  function selectHotspot(spot) {
    state.selectedHotspot = spot;
    const dParkings = getDistrictParkings();
    const nearest = dParkings.find((p) => p.id === spot.nearestParkingId);
    if (nearest) {
      state.selectedParking = nearest;
    }
    if (state.activeTab === 'HOTSPOTS') {
      state.activeTab = 'SPLIT';
    }
    renderAll();
  }

  function renderAll() {
    renderBannerAndMetrics();
    renderLayoutTab();
    renderMap();
    renderHotspots();
    renderParkings();
  }

  // --- 모달 제어 ---
  function openModal(modalEl) {
    modalEl.classList.remove('hidden');
  }

  function closeModal(modalEl) {
    modalEl.classList.add('hidden');
  }

  // --- 이벤트 바인딩 ---
  function bindEvents() {
    els.districtSelect.addEventListener('change', (e) => {
      const found = state.districts.find((d) => d.id === e.target.value);
      if (found) {
        state.selectedDistrict = found;
        state.selectedHotspot = null;
        state.selectedParking = null;
        renderAll();
      }
    });

    els.locateBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('현재 브라우저에서 위치 서비스를 지원하지 않습니다.');
        return;
      }
      state.isLocating = true;
      els.locateDot.classList.add('pulsing');
      els.locateText.textContent = '위치 확인 중...';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.isLocating = false;
          els.locateDot.classList.remove('pulsing');
          els.locateText.textContent = '내 주변';
          const { latitude, longitude } = pos.coords;
          let closest = state.districts[0];
          let minDiff = Infinity;
          state.districts.forEach((d) => {
            const diff = Math.hypot(d.centerLat - latitude, d.centerLng - longitude);
            if (diff < minDiff) {
              minDiff = diff;
              closest = d;
            }
          });
          state.selectedDistrict = closest;
          state.selectedHotspot = null;
          state.selectedParking = null;
          renderDistrictOptions();
          renderAll();
        },
        () => {
          state.isLocating = false;
          els.locateDot.classList.remove('pulsing');
          els.locateText.textContent = '내 주변';
          alert('위치 정보를 불러오지 못했습니다. 상단 목록에서 지역을 선택해 주세요.');
        },
        { timeout: 8000 }
      );
    });

    // Tabs
    els.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.getAttribute('data-tab');
        renderLayoutTab();
      });
    });

    // Map Engine Toggle
    els.btnEngineGoogle.addEventListener('click', () => {
      state.mapEngine = 'GOOGLE_EMBED';
      renderMap();
    });

    els.btnEngineLeaflet.addEventListener('click', () => {
      state.mapEngine = 'LEAFLET';
      renderMap();
    });

    els.btnSwitchToLeafletInline.addEventListener('click', () => {
      state.mapEngine = 'LEAFLET';
      renderMap();
    });

    els.btnGoogleSat.addEventListener('click', () => {
      state.googleMapType = 'k';
      renderMap();
    });

    els.btnGoogleRoad.addEventListener('click', () => {
      state.googleMapType = 'm';
      renderMap();
    });

    els.btnGoogleReset.addEventListener('click', () => {
      state.selectedHotspot = null;
      state.selectedParking = null;
      renderAll();
    });

    els.leafletFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.leafletFilterMode = btn.getAttribute('data-leaflet-filter');
        renderMap();
      });
    });

    // Hotspot Filters
    els.hotspotSearchInput.addEventListener('input', (e) => {
      state.hotspotSearch = e.target.value;
      renderHotspots();
    });

    els.hotspotTypeSelect.addEventListener('change', (e) => {
      state.hotspotTypeFilter = e.target.value;
      renderHotspots();
    });

    els.hotspotSeveritySelect.addEventListener('change', (e) => {
      state.hotspotSeverityFilter = e.target.value;
      renderHotspots();
    });

    // Parking Filters
    els.carTypeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.carType = btn.getAttribute('data-car-type');
        renderParkings();
      });
    });

    els.parkingFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.parkingFilterType = btn.getAttribute('data-parking-filter');
        renderParkings();
      });
    });

    els.parkingSortSelect.addEventListener('change', (e) => {
      state.parkingSortBy = e.target.value;
      renderParkings();
    });

    // Modal Open Triggers
    document.querySelectorAll('[data-open-report]').forEach((el) => {
      el.addEventListener('click', () => {
        els.reportSuccessBox.classList.add('hidden');
        els.reportForm.classList.remove('hidden');
        openModal(els.reportModal);
      });
    });

    document.querySelectorAll('[data-open-impact]').forEach((el) => {
      el.addEventListener('click', () => openModal(els.impactModal));
    });

    document.querySelectorAll('[data-open-safety]').forEach((el) => {
      el.addEventListener('click', () => openModal(els.safetyModal));
    });

    // Modal Close Triggers
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-close-modal');
        const modal = document.getElementById(targetId);
        if (modal) closeModal(modal);
      });
    });

    [els.reportModal, els.impactModal, els.safetyModal].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    });

    // Photo preview
    els.reportPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        state.photoPreviewDataUrl = ev.target && ev.target.result;
        els.reportPhotoStatus.textContent = '✓ 사진 등록 완료';
        els.reportPhotoStatus.style.color = '#059669';
      };
      reader.readAsDataURL(file);
    });

    // Report Form Submit
    els.reportForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const vType = els.reportViolationType.value;
      const locName = els.reportLocationName.value.trim();
      const addr = els.reportAddress.value.trim();
      const desc = els.reportDescription.value.trim();

      if (!locName || !addr) {
        alert('장소명과 상세 주소를 입력해주세요.');
        return;
      }

      const dParkings = getDistrictParkings();
      const vInfo = DATA.VIOLATION_INFO[vType] || DATA.VIOLATION_INFO.FIRE_HYDRANT;

      const newSpot = {
        id: `spot-user-${Date.now()}`,
        name: locName,
        district: state.selectedDistrict.id,
        address: addr,
        lat: state.selectedDistrict.centerLat + (Math.random() - 0.5) * 0.004,
        lng: state.selectedDistrict.centerLng + (Math.random() - 0.5) * 0.004,
        violationType: vType,
        severity:
          vType === 'SCHOOL_ZONE' || vType === 'FIRE_HYDRANT' ? 'CRITICAL' : 'HIGH',
        repeatCount: 1,
        reportedToday: 1,
        peakHours: '실시간 시민 제보 접수',
        description: desc || '이웃 시민에 의해 제보된 불법주차 위치입니다.',
        impactNote: `${vInfo.label} 위반으로 이웃 통행 및 긴급차량 진입에 지장을 초래함.`,
        nearestParkingId: dParkings[0] ? dParkings[0].id : '',
        reports: [
          {
            id: `rep-${Date.now()}`,
            timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            timeAgo: '방금 전',
            description: desc || '현장 시민 실시간 불법주차 제보',
            reporterNickname: '시민 제보자',
            resolved: false,
          },
        ],
      };

      state.hotspots.unshift(newSpot);
      state.selectedHotspot = newSpot;

      els.reportForm.classList.add('hidden');
      els.reportSuccessBox.classList.remove('hidden');

      setTimeout(() => {
        closeModal(els.reportModal);
        els.reportForm.reset();
        els.reportPhotoStatus.textContent =
          '차량 번호판과 위반 위치 표지판이 함께 나오면 효과적입니다.';
        els.reportPhotoStatus.style.color = '#94a3b8';
        state.photoPreviewDataUrl = null;
        renderAll();
      }, 1300);
    });
  }

  // --- 초기화 ---
  document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    renderDistrictOptions();
    bindEvents();
    renderAll();
  });
})();
