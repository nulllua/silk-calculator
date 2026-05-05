// Events, cities, traits, religions, languages

async function loadEvents(){
  const res=await api('/api/events'); if(!res.ok)return;
  const events=await res.json();
  el('events-body').innerHTML=events.map(e=>{
    const id=esc(e.name);
    const lvs=e.levels||[];
    return `
    <tr>
      <td class="hl">${escHtml(e.name)}</td><td>${escHtml(e.glyph)}</td><td>${e.dir>0?'+1':'-1'}</td>
      <td>${(e.good_types||[]).map(escHtml).join(', ')}</td><td>${(e.good_names||[]).map(escHtml).join(', ')}</td>
      <td>${escHtml(e.description)}</td>
      <td><button class="btn btn-del" data-name="${escHtml(e.name)}" onclick="delEventType(this)">Del</button></td>
    </tr>
    <tr><td colspan="7" class="sub">
      <h3>Levels for ${escHtml(e.name)}</h3>
      <table class="data" style="margin:0">
        <thead><tr><th>Lvl</th><th>Label</th><th>% (e.g. 0.05)</th><th>Base Bonus</th><th style="width:55px"></th></tr></thead>
        <tbody id="lvls-${id}">
          ${lvs.map(l=>`<tr>
            <td>${l.level}</td>
            <td><input class="ifield" value="${escHtml(l.label)}" style="width:90px" data-id="${l.id}" data-f="label" onchange="saveEvLvl(this)"></td>
            <td><input class="ifield" type="number" value="${l.pct}" step="0.001" style="width:78px" data-id="${l.id}" data-f="pct" onchange="saveEvLvl(this)"></td>
            <td><input class="ifield" type="number" value="${l.base_bonus}" style="width:68px" data-id="${l.id}" data-f="base_bonus" onchange="saveEvLvl(this)"></td>
            <td><button class="btn btn-del" data-id="${l.id}" onclick="delEvLvl(this)">Del</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input id="nelvl-${id}-lvl"   class="ifield" type="number" min="1" max="10" placeholder="Level"  style="width:58px">
        <input id="nelvl-${id}-label" class="ifield" type="text"   placeholder="Label"      style="width:88px">
        <input id="nelvl-${id}-pct"   class="ifield" type="number" step="0.001" placeholder="pct"   style="width:83px">
        <input id="nelvl-${id}-bb"    class="ifield" type="number" placeholder="base bonus"  style="width:83px">
        <button class="btn btn-add" data-name="${escHtml(e.name)}" data-eid="${id}" onclick="addEvLvl(this)">+ Add Level</button>
        <span class="ss" id="nelvl-${id}-ss"></span>
      </div>
    </td></tr>`;
  }).join('');
}
async function addEventType(){ const name=v('ne-name'),glyph=v('ne-glyph'),dir=parseInt(v('ne-dir')), gtypes=v('ne-types').split(',').map(s=>s.trim()).filter(Boolean), gnames=v('ne-names').split(',').map(s=>s.trim()).filter(Boolean), desc=v('ne-desc'); if(!name)return ss('ne-ss',false,'Need name'); const res=await api('/api/admin/events',{method:'POST',body:JSON.stringify({name,glyph,dir,good_types:gtypes,good_names:gnames,description:desc})}); ss('ne-ss',res.ok); if(res.ok){['ne-name','ne-glyph','ne-types','ne-names','ne-desc'].forEach(i=>el(i).value='');loadEvents();}}
async function delEventType(btn){ if(!confirm('Delete event "'+btn.dataset.name+'"?'))return; const res=await api('/api/admin/events/'+encodeURIComponent(btn.dataset.name),{method:'DELETE'}); if(res.ok)loadEvents();}
async function addEvLvl(btn){ const eid=btn.dataset.eid,name=btn.dataset.name; const level=parseInt(el(`nelvl-${eid}-lvl`).value), label=el(`nelvl-${eid}-label`).value.trim(), pct=parseFloat(el(`nelvl-${eid}-pct`).value), base_bonus=parseInt(el(`nelvl-${eid}-bb`).value)||0; if(!level||!label)return ss(`nelvl-${eid}-ss`,false,'Fill level & label'); const res=await api('/api/admin/events/'+encodeURIComponent(name)+'/levels',{method:'POST',body:JSON.stringify({level,label,pct,base_bonus})}); ss(`nelvl-${eid}-ss`,res.ok); if(res.ok)loadEvents();}
async function saveEvLvl(input){ const body={}; body[input.dataset.f]=input.dataset.f==='label'?input.value: input.dataset.f==='base_bonus'?parseInt(input.value):parseFloat(input.value); const res=await api('/api/admin/events/levels/'+input.dataset.id,{method:'PATCH',body:JSON.stringify(body)}); flash(input,res.ok);}
async function delEvLvl(btn){ const res=await api('/api/admin/events/levels/'+btn.dataset.id,{method:'DELETE'}); if(res.ok)loadEvents();}

let _traits=[], _goods=[];
async function loadCities(){ const [cr,tr,gr]=await Promise.all([api('/api/cities'),api('/api/cities/traits'),api('/api/goods')]); if(!cr.ok)return; const cities=await cr.json(); _traits=tr.ok?(await tr.json()).map(t=>t.name):_traits; _goods=gr.ok?(await gr.json()).map(g=>g.name):_goods;
  el('cities-body').innerHTML=cities.map(c=>{ const id=esc(c.name); const traits=c.traits||[], goods=c.produced||[]; const mtr=_traits.filter(t=>!traits.includes(t)); const mgd=_goods.filter(g=>!goods.includes(g)); return `
    <tr><td class="hl">${escHtml(c.name)}</td><td><input class="ifield ci-culture" value="${escHtml(c.culture)}"  style="width:90px"></td><td><input class="ifield ci-lang" value="${escHtml(c.language)}" style="width:90px"></td><td><select class="ifield ci-fire"><option value="false"${!c.has_fire_temple?' selected':''}>No</option><option value="true"${c.has_fire_temple?' selected':''}>Yes</option></select></td><td><button class="btn btn-save" data-name="${escHtml(c.name)}" onclick="saveCity(this)">Save</button><button class="btn btn-del" data-name="${escHtml(c.name)}" onclick="delCity(this)" style="margin-left:4px">Del</button><span class="ss" id="cs-${id}"></span></td></tr>
    <tr><td colspan="5" class="sub"><h3>Traits ${mtr.length?`<select id="ctsel-${id}" class="ifield" style="margin-left:8px;font-size:11px">${mtr.map(t=>`<option>${escHtml(t)}</option>`).join('')}</select><button class="btn btn-add" style="padding:3px 8px;font-size:11px;margin-left:4px" data-name="${escHtml(c.name)}" data-sid="ctsel-${id}" onclick="addCityTrait(this)">+ Add</button>`:''}</h3><div>${traits.map(t=>`<span class="tag">${escHtml(t)}<span class="x" data-city="${escHtml(c.name)}" data-trait="${escHtml(t)}" onclick="delCityTrait(this)">✕</span></span>`).join('')}${traits.length===0?'<span class="dim">None</span>':''}</div><h3 style="margin-top:10px">Produced Goods ${mgd.length?`<select id="cgsel-${id}" class="ifield" style="margin-left:8px;font-size:11px">${mgd.map(g=>`<option>${escHtml(g)}</option>`).join('')}</select><button class="btn btn-add" style="padding:3px 8px;font-size:11px;margin-left:4px" data-name="${escHtml(c.name)}" data-sid="cgsel-${id}" onclick="addCityGood(this)">+ Add</button>`:''}</h3><div>${goods.map(g=>`<span class="tag">${escHtml(g)}<span class="x" data-city="${escHtml(c.name)}" data-good="${escHtml(g)}" onclick="delCityGood(this)">✕</span></span>`).join('')}${goods.length===0?'<span class="dim">None</span>':''}</div></td></tr>`; }).join('');
}
async function saveCity(btn){ const row=btn.closest('tr'),name=btn.dataset.name; const culture=row.querySelector('.ci-culture').value.trim(); const language=row.querySelector('.ci-lang').value.trim(); const has_fire_temple=row.querySelector('.ci-fire').value==='true'; const res=await api('/api/admin/cities/'+encodeURIComponent(name),{method:'PATCH',body:JSON.stringify({culture,language,has_fire_temple})}); ss('cs-'+esc(name),res.ok);}
async function addCity(){ const name=v('nc-name'),culture=v('nc-culture'),language=v('nc-lang'),has_fire_temple=v('nc-fire')==='true'; if(!name)return ss('nc-ss',false,'Need name'); const res=await api('/api/admin/cities',{method:'POST',body:JSON.stringify({name,culture,language,has_fire_temple})}); ss('nc-ss',res.ok); if(res.ok){['nc-name','nc-culture','nc-lang'].forEach(i=>el(i).value='');loadCities();}}
async function delCity(btn){ if(!confirm('Delete city "'+btn.dataset.name+'"?'))return; const res=await api('/api/admin/cities/'+encodeURIComponent(btn.dataset.name),{method:'DELETE'}); if(res.ok)loadCities();}
async function addCityTrait(btn){ const trait=el(btn.dataset.sid)?.value; if(!trait)return; const res=await api('/api/admin/cities/'+encodeURIComponent(btn.dataset.name)+'/traits',{method:'POST',body:JSON.stringify({trait_name:trait})}); if(res.ok)loadCities();}
async function delCityTrait(span){ const res=await api('/api/admin/cities/'+encodeURIComponent(span.dataset.city)+'/traits/'+encodeURIComponent(span.dataset.trait),{method:'DELETE'}); if(res.ok)loadCities();}
async function addCityGood(btn){ const good=el(btn.dataset.sid)?.value; if(!good)return; const res=await api('/api/admin/cities/'+encodeURIComponent(btn.dataset.name)+'/goods',{method:'POST',body:JSON.stringify({good_name:good})}); if(res.ok)loadCities();}
async function delCityGood(span){ const res=await api('/api/admin/cities/'+encodeURIComponent(span.dataset.city)+'/goods/'+encodeURIComponent(span.dataset.good),{method:'DELETE'}); if(res.ok)loadCities();}

async function loadTraits(){ const [tr,er]=await Promise.all([api('/api/cities/traits'),api('/api/trait-effects')]); if(!tr.ok)return; const traits=await tr.json(); const effects=er.ok?await er.json():[]; el('traits-body').innerHTML=traits.map(t=>`<tr><td class="hl">${escHtml(t.name)}</td><td><input class="ifield" value="${escHtml(t.description)}" style="width:100%" data-name="${escHtml(t.name)}" onchange="saveTrait(this)"></td><td><button class="btn btn-del" data-name="${escHtml(t.name)}" onclick="delTrait(this)">Del</button></td></tr>`).join(''); el('effects-body').innerHTML=effects.map(e=>`<tr><td>${escHtml(e.trait_name)}</td><td>${escHtml(e.kind||'both')}</td><td><input class="ifield" type="number" value="${e.bonus}" step="0.001" style="width:70px" data-id="${e.id}" data-f="bonus" onchange="saveEffect(this)"></td><td>${escHtml(e.cond_type||'—')}</td><td>${escHtml(e.cond_value||'—')}</td><td><button class="btn btn-del" data-id="${e.id}" onclick="delEffect(this)">Del</button></td></tr>`).join('');}
async function saveTrait(input){ const res=await api('/api/admin/traits/'+encodeURIComponent(input.dataset.name),{method:'PATCH',body:JSON.stringify({description:input.value})}); flash(input,res.ok);}
async function addTrait(){ const name=v('nt-name'),description=v('nt-desc'); if(!name)return ss('nt-ss',false,'Need name'); const res=await api('/api/admin/traits',{method:'POST',body:JSON.stringify({name,description})}); ss('nt-ss',res.ok); if(res.ok){['nt-name','nt-desc'].forEach(i=>el(i).value='');loadTraits();}}
async function delTrait(btn){ if(!confirm('Delete trait "'+btn.dataset.name+'"?'))return; const res=await api('/api/admin/traits/'+encodeURIComponent(btn.dataset.name),{method:'DELETE'}); if(res.ok)loadTraits();}
async function addEffect(){ const trait_name=v('nfx-trait'),kind=v('nfx-kind')||null,bonus=parseFloat(v('nfx-bonus')), cond_type=v('nfx-ctype')||null,cond_value=v('nfx-cval')||null; if(!trait_name||isNaN(bonus))return ss('nfx-ss',false,'Need trait & bonus'); const res=await api('/api/admin/trait-effects',{method:'POST',body:JSON.stringify({trait_name,kind,bonus,cond_type,cond_value})}); ss('nfx-ss',res.ok); if(res.ok){['nfx-trait','nfx-bonus','nfx-cval'].forEach(i=>el(i).value='');loadTraits();}}
async function saveEffect(input){ const body={};body[input.dataset.f]=parseFloat(input.value); const res=await api('/api/admin/trait-effects/'+input.dataset.id,{method:'PATCH',body:JSON.stringify(body)}); flash(input,res.ok);}
async function delEffect(btn){ const res=await api('/api/admin/trait-effects/'+btn.dataset.id,{method:'DELETE'}); if(res.ok)loadTraits();}

async function loadReligions(){ const [rr,pr]=await Promise.all([api('/api/religions'),api('/api/religion-perks')]); if(!rr.ok)return; const religions=await rr.json(); const perks=pr.ok?await pr.json():[]; el('religions-body').innerHTML=religions.map(r=>`<tr><td class="hl">${escHtml(r.name)}</td><td><button class="btn btn-del" data-name="${escHtml(r.name)}" onclick="delReligion(this)">Del</button></td></tr>`).join(''); el('perks-body').innerHTML=perks.map(p=>`<tr><td>${escHtml(p.religion)}</td><td>${p.min_level}</td><td>${escHtml(p.perk_type)}</td><td><input class="ifield" type="number" value="${p.multiplier}" step="0.1" style="width:70px" data-id="${p.id}" data-f="multiplier" onchange="savePerk(this)"></td><td><input class="ifield" value="${escHtml(p.description)}" style="width:100%" data-id="${p.id}" data-f="description" onchange="savePerk(this)"></td><td><button class="btn btn-del" data-id="${p.id}" onclick="delPerk(this)">Del</button></td></tr>`).join('');}
async function addReligion(){ const name=v('nr-name'); if(!name)return ss('nr-ss',false,'Need name'); const res=await api('/api/admin/religions',{method:'POST',body:JSON.stringify({name})}); ss('nr-ss',res.ok); if(res.ok){el('nr-name').value='';loadReligions();}}
async function delReligion(btn){ if(!confirm('Delete "'+btn.dataset.name+'"?'))return; const res=await api('/api/admin/religions/'+encodeURIComponent(btn.dataset.name),{method:'DELETE'}); if(res.ok)loadReligions();}
async function addPerk(){ const religion=v('np-rel'),min_level=parseInt(v('np-lvl')),perk_type=v('np-type'), multiplier=parseFloat(v('np-mult')),description=v('np-desc'); if(!religion||!min_level)return ss('np-ss',false,'Fill religion & level'); const res=await api('/api/admin/religion-perks',{method:'POST',body:JSON.stringify({religion,min_level,perk_type,multiplier,description})}); ss('np-ss',res.ok); if(res.ok){['np-rel','np-lvl','np-mult','np-desc'].forEach(i=>el(i).value='');loadReligions();}}
async function savePerk(input){ const body={};body[input.dataset.f]=input.dataset.f==='multiplier'?parseFloat(input.value):input.value; const res=await api('/api/admin/religion-perks/'+input.dataset.id,{method:'PATCH',body:JSON.stringify(body)}); flash(input,res.ok);}
async function delPerk(btn){ const res=await api('/api/admin/religion-perks/'+btn.dataset.id,{method:'DELETE'}); if(res.ok)loadReligions();}

async function loadLanguages(){ const res=await api('/api/languages'); if(!res.ok)return; el('languages-body').innerHTML=(await res.json()).map(l=>`<tr><td class="hl">${escHtml(l.name)}</td><td><button class="btn btn-del" data-name="${escHtml(l.name)}" onclick="delLanguage(this)">Del</button></td></tr>`).join('');}
async function addLanguage(){ const name=v('nl-name'); if(!name)return ss('nl-ss',false,'Need name'); const res=await api('/api/admin/languages',{method:'POST',body:JSON.stringify({name})}); ss('nl-ss',res.ok); if(res.ok){el('nl-name').value='';loadLanguages();}}
async function delLanguage(btn){ if(!confirm('Delete "'+btn.dataset.name+'"?'))return; const res=await api('/api/admin/languages/'+encodeURIComponent(btn.dataset.name),{method:'DELETE'}); if(res.ok)loadLanguages();}
