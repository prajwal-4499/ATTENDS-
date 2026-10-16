import React from 'react';
import { useApp } from '../context/AppContext';
import {
  CalendarCheck,
  TabletSmartphone,
  Users,
  Wallet,
  FileSpreadsheet,
  HardDrive
} from 'lucide-react';

export default function Navigation() {
  const { activeTab, setActiveTab } = useApp();

  const tabs = [
    { id: 'attendance', label: '1-Click Attendance', icon: CalendarCheck },
    { id: 'kiosk', label: 'Counter Kiosk', icon: TabletSmartphone, highlight: true },
    { id: 'staff', label: 'Staff Master', icon: Users },
    { id: 'salary', label: 'Salary & Khata Ledger', icon: Wallet },
    { id: 'muster', label: 'Muster Roll & Payslips', icon: FileSpreadsheet },
    { id: 'backup', label: 'Offline Backup & SQL', icon: HardDrive }
  ];

  return (
    <nav className="nav-bar no-print">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-tab ${isActive ? 'active' : ''} ${tab.highlight && !isActive ? 'kiosk-tab-highlight' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon size={17} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
