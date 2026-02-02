export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Visible as per request
  balance: number;
  phone: string;
  status: 'active' | 'blocked';
  joinedDate: string;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  password?: string;
  balance: number;
  commissionRate: number; // Amount per 1000 Currency Unit
  isActive: boolean;
  totalEarned: number;
}

export interface Transaction {
  id: string;
  userId: string;
  userEmail: string;
  type: 'deposit' | 'withdraw' | 'commission' | 'adjustment' | 'bonus';
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  method?: string;
  details?: string; // TrxID or Number
  agentId?: string; // To track who processed/received commission
}

export interface DepositMethod {
  id: string;
  name: string; // Bkash, Nagad etc.
  type: 'Personal' | 'Agent' | 'Merchant';
  number: string;
  minAmount: number;
  maxAmount: number;
  instruction: string; // "Cash out" or "Send Money"
  requirements: string[]; // ["TrxID", "Last 4 Digit"]
  status: 'pending' | 'active' | 'inactive' | 'rejected';
  addedBy: 'admin' | 'agent';
  agentName?: string;
  agentId?: string; // Link to specific agent
  audience: 'All' | 'Agents Only' | 'Users Only';
}

export interface Settings {
  dollarRate: number;
  noticeText: string;
  telegramLink: string;
  whatsappLink: string;
  minWithdraw: number;
  withdrawMethods: string[]; // List of available methods names
}