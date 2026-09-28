import { addressKeys, matchAddress } from '../domain/duplicates.js';
import { terminalStatuses } from '../domain/leads.js';
// Only this minimal projection may cross portfolio boundaries.
export async function duplicates(db,lead,numbers=[],exclude='') {
  const keys=addressKeys(lead); const items=[];
  const safe = (row,type) => ({type,owner_name:row.owner_name,status:row.status,created_at:row.created_at,historical:terminalStatuses.includes(row.status)});
  const addresses=await db.prepare('SELECT l.city_key,l.street_key,l.number_key,l.complement_key,l.state_key,l.status,l.created_at,u.name AS owner_name FROM leads l JOIN users u ON u.id=l.owner_id WHERE l.city_key=? AND l.street_key=? AND l.id<>? LIMIT 101').bind(keys.city_key,keys.street_key,exclude).all();
  for(const row of addresses.results.slice(0,100)) {const type=matchAddress(keys,row); if(type) items.push(safe(row,type));}
  let truncated=addresses.results.length>100;
  if(numbers.length) {
    const phones=[...new Set(numbers)];
    for(let offset=0;offset<phones.length;offset+=90) {
    const chunk=phones.slice(offset,offset+90);
    const found=await db.prepare(`SELECT DISTINCT l.id,l.status,l.created_at,u.name AS owner_name FROM contacts c JOIN leads l ON l.id=c.lead_id JOIN users u ON u.id=l.owner_id WHERE c.phone IN (${chunk.map(()=>'?').join(',')}) AND l.id<>? LIMIT 101`).bind(...chunk,exclude).all();
    truncated ||= found.results.length>100;
    for(const row of found.results.slice(0,100)) items.push(safe(row,'Telefone já cadastrado'));
    }
  }
  const pending=await db.prepare('SELECT 1 AS pending FROM leads WHERE key_version=0 LIMIT 1').first();
  return {items:items.slice(0,30),truncated:truncated || items.length>30,incomplete:!keys.number_key || !keys.state_key || Boolean(pending)};
}
