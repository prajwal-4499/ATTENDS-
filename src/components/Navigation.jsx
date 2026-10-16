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
    { id: 'attendance', label: '1-Click Attendance', shortLabel: 'Attendance', icon: CalendarCheck },
    { id: 'kiosk', label: 'Counter Kiosk', shortLabel: 'Kiosk', icon: TabletSmartphone, highlight: true },
    { id: 'staff', label: 'Staff Master', shortLabel: 'Staff', icon: Users },
    { id: 'salary', label: 'Salary Ledger', shortLabel: 'Salary', icon: Wallet },
    { id: 'muster', label: 'Muster Roll', shortLabel: 'Reports', icon: FileSpreadsheet },
    { id: 'backup', label: 'Backup & SQL', shortLabel: 'Backup', icon: HardDrive }
  ];

  return (
    <nav className="nav-bar no-print" aria-label="Main Navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-tab ${isActive ? 'active' : ''} ${tab.highlight && !isActive ? 'kiosk-tab-highlight' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <Icon size={18} />
            <span className="nav-tab-label-full">{tab.label}</span>
            <span className="nav-tab-label-short">{tab.shortLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}
