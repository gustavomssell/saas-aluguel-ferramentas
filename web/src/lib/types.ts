export type Role = 'OWNER' | 'ADMIN' | 'OPERATOR'

export type RentalStatus = 'QUOTED' | 'ACTIVE' | 'RETURN_PENDING' | 'RETURNED' | 'CANCELLED'

export type AuthUser = {
  id: string
  name: string
  email: string
}

export type Membership = {
  organizationId: string
  name: string
  slug: string
  role: Role
}

export type Organization = {
  id: string
  name: string
  slug: string
  role: Role
}

export type Session = {
  token: string
  user: AuthUser
  organization: Organization
  memberships: Membership[]
}

export type Category = {
  id: string
  name: string
  slug: string
  equipmentCount?: number
}

export type Equipment = {
  id: string
  code: string
  name: string
  description: string | null
  brand: string | null
  unit: string
  weightKg: number | null
  dailyRate: number
  weeklyRate: number | null
  monthlyRate: number | null
  replacementValue: number
  stockTotal: number
  stockMaintenance: number
  imageUrl: string | null
  active: boolean
  reservedToday: number
  availableToday: number
  inFieldToday: number
  category: { id: string; name: string; slug: string }
}

export type AvailabilityRow = {
  id: string
  code: string
  name: string
  categoryName: string
  stockTotal: number
  stockMaintenance: number
  reserved: number
  available: number
}

export type AvailabilityResponse = {
  from: string
  to: string
  equipments: AvailabilityRow[]
}

export type KitItem = {
  id: string
  equipmentId: string
  quantity: number
  code: string
  name: string
  unit: string
  weightKg: number | null
  dailyRate: number
  categoryName: string
}

export type Kit = {
  id: string
  name: string
  description: string | null
  heightMeters: number | null
  facadeMeters: number | null
  notes: string | null
  createdAt: string
  totalWeightKg: number
  estimatedDailyRate: number
  items: KitItem[]
}

export type Customer = {
  id: string
  name: string
  document: string | null
  contactName: string | null
  phone: string | null
  email: string | null
  siteAddress: string | null
  city: string | null
  notes: string | null
  rentalCount: number
  openRentals: number
}

export type TeamMember = {
  membershipId: string
  userId: string
  name: string
  email: string
  role: Role
  roleLabel: string
  joinedAt: string
  isCurrentUser: boolean
}

export type TeamInvite = {
  id: string
  email: string
  role: Role
  roleLabel: string
  expiresAt: string
  createdAt: string
}

export type OrganizationSettings = {
  id: string
  name: string
  slug: string
  document: string | null
  phone: string | null
  email: string | null
  city: string | null
  role: Role
}

export type TeamResponse = {
  organization: OrganizationSettings
  members: TeamMember[]
  invites: TeamInvite[]
}

export type ChargeKind = 'RENT' | 'DEPOSIT' | 'LATE_FEE' | 'DAMAGE' | 'OTHER'

export type ChargeStatus = 'PENDING' | 'PAID' | 'CANCELLED'

export type Charge = {
  id: string
  kind: ChargeKind
  kindLabel: string
  status: ChargeStatus
  statusLabel: string
  description: string | null
  amount: number
  dueDate: string
  paidAt: string | null
  method: string | null
  createdAt: string
  customer: { id: string; name: string }
  rental: { id: string; code: string } | null
  overdue: boolean
}

export type FinanceSummary = {
  generatedAt: string
  totals: {
    openAmount: number
    overdueAmount: number
    dueThisWeekAmount: number
    receivedThisMonth: number
    receivedInRange: number
    depositHeld: number
    openCount: number
    overdueCount: number
  }
  byKind: Array<{
    kind: ChargeKind
    label: string
    openAmount: number
    openCount: number
    receivedAmount: number
  }>
  series: Array<{ month: string; billed: number; received: number }>
  attention: Charge[]
}

export type ContractResponse = {
  generatedAt: string
  organization: {
    name: string
    document: string | null
    phone: string | null
    email: string | null
    city: string | null
    slug: string
  } | null
  rental: Rental
}

export type RentalItem = {
  id: string
  equipmentId: string
  code: string
  name: string
  unit: string
  categoryName: string
  quantity: number
  dailyRate: number
  weightKg: number | null
  periodTotal: number
  priceExplanation: string
}

export type InspectionItem = {
  id: string
  quantityExpected: number
  quantityChecked: number
  damaged: number
  missing: number
  notes: string | null
  equipment: { id: string; code: string; name: string }
}

export type RentalInspection = {
  id: string
  kind: 'DELIVERY' | 'RETURN'
  kindLabel: string
  checkedAt: string
  notes: string | null
  createdAt: string
  items: InspectionItem[]
}

export type Rental = {
  id: string
  code: string
  status: RentalStatus
  statusLabel: string
  startsAt: string
  expectedReturnAt: string
  returnedAt: string | null
  depositAmount: number
  siteName: string | null
  notes: string | null
  createdAt: string
  customer: { id: string; name: string; city: string | null; phone: string | null }
  days: number
  totalWeightKg: number
  periodTotal: number
  dailyTotal: number
  finance: {
    openAmount: number
    overdueAmount: number
    paidAmount: number
    openCount: number
    overdueCount: number
  }
  items: RentalItem[]
  inspections: RentalInspection[]
  events: Array<{ id: string; type: string; message: string; createdAt: string }>
}

export type TimelineSegment = {
  rentalId: string
  code: string
  status: RentalStatus
  statusLabel: string
  customerName: string
  siteName: string | null
  startsAt: string
  expectedReturnAt: string
  quantity: number
}

export type TimelineLane = {
  id: string
  code: string
  name: string
  unit: string
  categoryId: string
  categoryName: string
  stockTotal: number
  stockMaintenance: number
  peakLoad: number
  loadByDay: number[]
  segments: TimelineSegment[]
}

export type TimelineResponse = {
  from: string
  to: string
  today: string
  days: string[]
  equipments: TimelineLane[]
}

export type Dashboard = {
  generatedAt: string
  stock: {
    unitsTotal: number
    unitsInField: number
    unitsAvailable: number
    unitsMaintenance: number
    utilization: number
  }
  counts: {
    equipment: number
    openRentals: number
    late: number
    pendingReturns: number
    returnsNext7Days: number
  }
  revenueNext30Days: number
  categories: Array<{
    id: string
    name: string
    units: number
    inField: number
    available: number
    utilization: number
  }>
  statusCounts: Array<{ status: RentalStatus; label: string; count: number }>
  attention: Array<{
    id: string
    code: string
    status: RentalStatus
    statusLabel: string
    customerName: string
    siteName: string | null
    expectedReturnAt: string
    days: number
    dailyTotal: number
    quantity: number
    kind: 'LATE' | 'PENDING' | 'UPCOMING'
  }>
}

export type ReportsResponse = {
  range: { from: string; to: string; days: number }
  kpis: {
    billed: number
    received: number
    openAmount: number
    overdueAmount: number
    rentalRevenue: number
    rentalCount: number
    avgTicket: number
    utilization: number
    peakUtilization: number
    lateCount: number
    unitsOut: number
    capacity: number
  }
  series: Array<{ month: string; billed: number; received: number }>
  topEquipment: Array<{ code: string; name: string; categoryName: string; quantity: number; revenue: number }>
  topCustomers: Array<{ id: string; name: string; rentals: number; revenue: number }>
  categoryMix: Array<{ name: string; revenue: number; share: number }>
  statusCounts: Array<{ status: RentalStatus; label: string; count: number }>
}


export type StockMovement = {
  id: string
  kind: 'ADJUSTMENT' | 'MAINTENANCE'
  delta: number
  balance: number
  note: string
  createdAt: string
  createdByName: string | null
}

export type EquipmentHistoryEntry = {
  id: string
  kind: 'STOCK' | 'RENTAL' | 'INSPECTION'
  date: string
  title: string
  detail: string | null
  tone: 'neutral' | 'positive' | 'negative' | 'warning'
}

