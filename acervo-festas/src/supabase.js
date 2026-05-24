import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yyqqizuxkdmeprmgdhgy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXFpenV4a2RtZXBybWdkaGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDY2ODEsImV4cCI6MjA5NTIyMjY4MX0.4-x6IfzZjghQY8FOxt6jGG_1VHJC8nJJPH3shPcje78'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Conversores DB (snake_case) ↔ JS (camelCase) ─────────────────────────────
export const dbToInventory = (r) => ({
  id:          r.id,
  name:        r.name,
  quantity:    r.quantity,
  rentalPrice: r.rental_price,
  painted:     r.painted,
  material:    r.material,
  category:    r.category || '',
  notes:       r.notes    || '',
  createdAt:   r.created_at,
})

export const inventoryToDB = (item) => ({
  id:           item.id,
  name:         item.name,
  quantity:     Number(item.quantity  || 0),
  rental_price: Number(item.rentalPrice || 0),
  painted:      item.painted,
  material:     item.material,
  category:     item.category || '',
  notes:        item.notes    || '',
})

export const dbToRental = (r) => ({
  id:          r.id,
  tenantName:  r.tenant_name,
  address:     r.address    || '',
  phone:       r.phone      || '',
  rentalDate:  r.rental_date|| '',
  amountPaid:  r.amount_paid|| 0,
  exitBy:      r.exit_by    || '',
  status:      r.status,
  totalOrder:  r.total_order|| 0,
  items:       r.items      || [],
  createdAt:   r.created_at,
})

export const rentalToDB = (r) => ({
  id:           r.id,
  tenant_name:  r.tenantName,
  address:      r.address   || '',
  phone:        r.phone     || '',
  rental_date:  r.rentalDate|| null,
  amount_paid:  Number(r.amountPaid  || 0),
  exit_by:      r.exitBy    || '',
  status:       r.status    || 'ativa',
  total_order:  Number(r.totalOrder  || 0),
  items:        r.items     || [],
})
