import React, { useState, useEffect } from 'react';
import { User, Agent, Transaction, DepositMethod, Settings } from './types';
import DashboardStats from './components/DashboardStats';
import UserHistory from './components/UserHistory';
import AgentManager from './components/AgentManager';
import WithdrawRequests from './components/WithdrawRequests';
import DepositMonitor from './components/DepositMonitor';
import SettingsPanel from './components/SettingsPanel';
import MonthlyReport from './components/MonthlyReport';
import LoginScreen from './components/LoginScreen';
import { LayoutDashboard, Users, UserCog, CreditCard, Settings as SettingsIcon, LogOut, Menu, Activity, CalendarRange, Wifi } from 'lucide-react';
import { 
  subscribeToUsers, 
  subscribeToAgents, 
  subscribeToTransactions, 
  subscribeToDepositMethods, 
  subscribeToSettings,
  updateTransactionStatus,
  updateUserBalance,
  updateAgent,
  addTransaction
} from './services/firebaseService';

const App = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // State Management (Data from Firebase)
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [depositMethods, setDepositMethods] = useState<DepositMethod[]>([]);
  const [settings, setSettings] = useState<Settings>({
    dollarRate: 0, noticeText: '', telegramLink: '', whatsappLink: '', minWithdraw: 0, withdrawMethods: []
  });
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // --- Firebase Subscriptions ---
  useEffect(() => {
    if (isAuthenticated) {
      // Subscribe to all collections when logged in
      const unsubUsers = subscribeToUsers(setUsers);
      const unsubAgents = subscribeToAgents(setAgents);
      const unsubTrx = subscribeToTransactions(setTransactions);
      const unsubMethods = subscribeToDepositMethods(setDepositMethods);
      const unsubSettings = subscribeToSettings(setSettings);

      // Cleanup on unmount/logout
      return () => {
        unsubUsers();
        unsubAgents();
        unsubTrx();
        unsubMethods();
        unsubSettings();
      };
    }
  }, [isAuthenticated]);

  // Login Handler
  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab('dashboard');
  };

  // --- Logic Handlers (Updated for Firebase) ---

  const handleWithdrawAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const trx = transactions.find(t => t.id === id);
      if (!trx) return;

      const user = users.find(u => u.id === trx.userId || u.email === trx.userEmail);

      // Safety Check for Approval
      if (action === 'approve') {
        if (!user) {
          alert("User not found!");
          return;
        }
        if (user.balance < trx.amount) {
          alert(`Failed! User only has $${user.balance}. Cannot withdraw $${trx.amount}.`);
          return;
        }
        
        // Deduct Balance
        await updateUserBalance(user.id, user.balance - trx.amount);
      }

      // Update Transaction Status
      await updateTransactionStatus(id, action === 'approve' ? 'approved' : 'rejected');
      
      if (action === 'approve') {
         alert("সফল! উইথড্র এপ্রুভ হয়েছে এবং ইউজারের ব্যালেন্স থেকে টাকা কেটে নেওয়া হয়েছে।");
      } else {
         alert("উইথড্র বাতিল করা হয়েছে।");
      }

    } catch (error) {
      console.error("Error updating withdraw:", error);
      alert("Error processing withdrawal");
    }
  };

  const handleDepositReject = async (id: string) => {
    await updateTransactionStatus(id, 'rejected');
    alert("Deposit Request Rejected.");
  };

  const handleDepositApproval = async (id: string) => {
    const trx = transactions.find(t => t.id === id);
    if (!trx || trx.type !== 'deposit') return;

    const agentId = trx.agentId;
    
    if (agentId) {
      const agent = agents.find(a => a.id === agentId);
      if (agent && agent.isActive) {
         
         if (agent.balance < trx.amount) {
             alert(`ব্যর্থ! এজেন্টের একাউন্টে পর্যাপ্ত ডলার নেই। (আছে: $${agent.balance}, প্রয়োজন: $${trx.amount})`);
             return;
         }

         // Calculations
         const commissionAmount = (trx.amount / 1000) * agent.commissionRate;
         const newAgentBalance = agent.balance - trx.amount + commissionAmount;

         try {
           // 1. Update Agent Balance
           await updateAgent(agent.id, { 
             balance: newAgentBalance, 
             totalEarned: agent.totalEarned + commissionAmount 
           });

           // 2. Update User Balance
           const user = users.find(u => u.id === trx.userId || u.email === trx.userEmail);
           if (user) {
             await updateUserBalance(user.id, user.balance + trx.amount);
           }

           // 3. Create Commission Transaction
           const commTrx: Transaction = {
              id: `comm-${Date.now()}`, // Simple ID generation
              userId: agent.id, 
              userEmail: `Agent: ${agent.name}`,
              type: 'commission',
              amount: commissionAmount,
              date: new Date().toISOString().split('T')[0],
              status: 'approved',
              method: 'System',
              details: `Commission for Deposit (Rate: ${agent.commissionRate}/1k)`
           };
           await addTransaction(commTrx);

           // 4. Update Original Transaction Status
           await updateTransactionStatus(id, 'approved');
           
           alert(`সফল! ট্রানজেকশন সম্পন্ন হয়েছে।`);
         } catch (error) {
           console.error(error);
           alert("ডেটাবেস এরর হয়েছে!");
         }
         return;
      }
    }

    // Fallback: Admin Direct
    try {
      const user = users.find(u => u.id === trx.userId || u.email === trx.userEmail);
      if (user) {
        await updateUserBalance(user.id, user.balance + trx.amount);
      }
      await updateTransactionStatus(id, 'approved');
      alert("Deposit Approved (Admin Direct)");
    } catch (e) {
      console.error(e);
      alert("Error in direct deposit");
    }
  };

  const handleSendBonus = async (agentId: string, amount: number) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    try {
      // 1. Update Agent
      await updateAgent(agentId, {
        balance: agent.balance + amount,
        totalEarned: agent.totalEarned + amount
      });

      // 2. Add Record
      const bonusTrx: Transaction = {
        id: `bonus-${Date.now()}`,
        userId: agent.id,
        userEmail: `Agent: ${agent.name}`,
        type: 'bonus',
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        status: 'approved',
        method: 'System',
        details: 'Monthly Performance Bonus'
      };
      await addTransaction(bonusTrx);

      alert(`${agent.name}-কে $${amount} বোনাস পাঠানো হয়েছে!`);
    } catch (e) {
      console.error(e);
      alert("Failed to send bonus");
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: <LayoutDashboard size={20} /> },
    { id: 'users', label: 'ইজারা হিস্টোরি', icon: <Users size={20} /> },
    { id: 'agents', label: 'সাব-এজেন্ট', icon: <UserCog size={20} /> },
    { id: 'deposits', label: 'ডিপোজিট রিকোয়েস্ট', icon: <Activity size={20} /> }, 
    { id: 'reports', label: 'মাসিক রিপোর্ট', icon: <CalendarRange size={20} /> }, 
    { id: 'withdrawals', label: 'উইথড্র রিকোয়েস্ট', icon: <CreditCard size={20} /> },
    { id: 'settings', label: 'সেটিংস', icon: <SettingsIcon size={20} /> },
  ];

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100 font-sans text-gray-800 pb-16 md:pb-0">
      
      {/* Desktop Sidebar */}
      <aside className={`hidden md:block bg-slate-900 text-white transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} fixed h-full z-20`}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && <h1 className="text-xl font-bold text-blue-400">Master Admin</h1>}
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white">
            <Menu size={24} />
          </button>
        </div>
        
        <nav className="mt-6">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center p-4 hover:bg-slate-800 transition-colors ${activeTab === item.id ? 'bg-blue-600 border-r-4 border-blue-300' : ''}`}
            >
              <span className="mr-4">{item.icon}</span>
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        
        <div className="absolute bottom-0 w-full p-4">
           <button 
             onClick={handleLogout}
             className="flex items-center text-red-400 hover:text-red-300 w-full p-2"
           >
             <LogOut size={20} className="mr-4" />
             {isSidebarOpen && "Log Out"}
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 p-4 md:p-8 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
              {menuItems.find(i => i.id === activeTab)?.label}
            </h2>
            <p className="text-gray-500 mt-1 text-sm md:text-base">Today is {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200 shadow-sm animate-pulse">
               <Wifi size={12} className="text-green-600" />
               Firebase Connected
            </div>
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold">
              Admin
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <DashboardStats users={users} agents={agents} transactions={transactions} />
        )}

        {activeTab === 'users' && (
          <UserHistory users={users} transactions={transactions} />
        )}

        {activeTab === 'agents' && (
          <AgentManager agents={agents} setAgents={setAgents} />
        )}

        {activeTab === 'deposits' && (
          <DepositMonitor 
            transactions={transactions} 
            agents={agents} 
            onApprove={handleDepositApproval} 
            onReject={handleDepositReject}
          />
        )}

        {activeTab === 'reports' && (
          <MonthlyReport 
            agents={agents} 
            transactions={transactions} 
            onSendBonus={handleSendBonus} 
          />
        )}

        {activeTab === 'withdrawals' && (
          <WithdrawRequests transactions={transactions} users={users} onAction={handleWithdrawAction} />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel 
            settings={settings} 
            setSettings={setSettings} 
            depositMethods={depositMethods} 
            setDepositMethods={setDepositMethods} 
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 text-white flex justify-around items-center p-2 z-50 shadow-lg border-t border-slate-700">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === item.id ? 'text-blue-400' : 'text-gray-400'}`}
          >
            {item.icon}
            <span className="text-[10px] mt-1">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;