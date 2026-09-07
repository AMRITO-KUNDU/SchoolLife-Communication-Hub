import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Redirect, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Circle, ClipboardCheck, Clock3, FileText, Filter, GraduationCap, Inbox as InboxIcon,
  Info, LayoutDashboard, ListChecks, Mail, Menu, MessageCircle, MoreHorizontal,
  Paperclip, Plus, RefreshCw, Search, Send, Settings as SettingsIcon, ShieldCheck,
  Sparkles, Tag, Trash2, UserRound, Users, X, Zap
} from 'lucide-react';

type View = 'home' | 'plan' | 'calendar' | 'inbox' | 'sources' | 'profile' | 'settings';
type ChildId = 'aarav' | 'emma';
type TaskStatus = 'open' | 'completed';
type Priority = 'urgent' | 'important' | 'normal';

type Child = { id: ChildId; name: string; grade: string; className: string; school: string; subjects: string[] };
type Task = { id: string; title: string; kind: string; priority: Priority; childId: ChildId; dueDate: string; dueTime?: string; source: string; status: TaskStatus; items: string[] };
type EventItem = { id: string; title: string; date: string; time: string; childId: ChildId; kind: string; source: string };
type Message = { id: string; sender: string; snippet: string; summary: string; detected: string; category: string; needsAction: boolean; childId: ChildId };
type Source = { id: string; name: string; status: 'Connected' | 'Connect'; detail: string; lastSync: string; groups?: string[] };

const children: Child[] = [
  { id: 'aarav', name: 'Aarav Kundu', grade: 'Grade 6', className: 'Class 6A', school: 'Greenwood International School', subjects: ['Math', 'Science', 'English', 'History', 'Sports'] },
  { id: 'emma', name: 'Emma Kundu', grade: 'Grade 3', className: 'Class 3B', school: 'Greenwood International School', subjects: ['Math', 'English', 'Art', 'Music', 'Sports'] },
];

const initialTasks: Task[] = [
  { id: 'science', title: 'Submit science project', kind: 'Homework', priority: 'urgent', childId: 'aarav', dueDate: 'Sep 9', dueTime: '8:00 PM', source: 'Class 6A Parents WhatsApp', status: 'open', items: ['Blue chart paper', 'Printed research', 'Colored markers'] },
  { id: 'permission', title: 'Return school trip permission slip', kind: 'Permission', priority: 'important', childId: 'aarav', dueDate: 'Sep 10', dueTime: '9:00 AM', source: 'School Office', status: 'open', items: ['Signed permission slip'] },
  { id: 'trip-fee', title: 'Pay ₹1,250 school trip fee', kind: 'Payments', priority: 'important', childId: 'aarav', dueDate: 'Sep 11', dueTime: '5:00 PM', source: 'Greenwood School App', status: 'open', items: [] },
  { id: 'chart-paper', title: 'Buy blue chart paper & sketch pens', kind: 'Shopping', priority: 'normal', childId: 'aarav', dueDate: 'Sep 8', dueTime: '6:00 PM', source: 'Class 6A Parents WhatsApp', status: 'open', items: ['Blue chart paper', 'Sketch pens'] },
  { id: 'english', title: 'Finish English worksheet', kind: 'Homework', priority: 'normal', childId: 'emma', dueDate: 'Sep 9', dueTime: '7:00 PM', source: 'Emma’s class email', status: 'open', items: [] },
  { id: 'uniform', title: 'Pack sports uniform', kind: 'Shopping', priority: 'normal', childId: 'aarav', dueDate: 'Sep 12', dueTime: '7:30 AM', source: 'School Office', status: 'open', items: [] },
];

const events: EventItem[] = [
  { id: 'math-test', title: 'Math Test', date: 'Sep 8', time: '10:30 AM', childId: 'aarav', kind: 'Assessment', source: 'Math Teacher' },
  { id: 'science-event', title: 'Science Project Due', date: 'Sep 9', time: '8:00 PM', childId: 'aarav', kind: 'Deadline', source: 'Class 6A Parents WhatsApp' },
  { id: 'ptm', title: 'Parent-Teacher Meeting', date: 'Sep 10', time: '3:30 PM', childId: 'aarav', kind: 'Meeting', source: 'School Office' },
  { id: 'trip', title: 'School Trip', date: 'Sep 11', time: '7:30 AM', childId: 'aarav', kind: 'Event', source: 'Greenwood School App' },
  { id: 'football', title: 'Football Tournament', date: 'Sep 12', time: '8:00 AM', childId: 'aarav', kind: 'Sports', source: 'Sports Coach' },
  { id: 'emma-art', title: 'Art showcase', date: 'Sep 15', time: '4:00 PM', childId: 'emma', kind: 'Event', source: 'Emma’s class email' },
];

const messages: Message[] = [
  { id: 'm1', sender: 'Class 6A Parents', snippet: 'Reminder: science activity this Friday. Please send blue chart paper...', summary: 'Aarav needs to submit a science project with chart paper and sketch pens.', detected: 'Task · due Wednesday, 8 PM', category: 'Homework', needsAction: true, childId: 'aarav' },
  { id: 'm2', sender: 'Greenwood School', snippet: 'The annual learning trip to the Science Museum is confirmed for...', summary: 'School trip is Friday. Fee of ₹1,250 is due before departure.', detected: 'Payment · due Friday', category: 'Payments', needsAction: true, childId: 'aarav' },
  { id: 'm3', sender: 'School Office', snippet: 'Parent-teacher meeting schedule for Term 1 is now available...', summary: 'Parent-teacher meeting for Class 6A is Thursday at 3:30 PM.', detected: 'Event · Thursday, 3:30 PM', category: 'Events', needsAction: false, childId: 'aarav' },
  { id: 'm4', sender: 'Math Teacher', snippet: 'A quick note about next week’s chapter test and revision topics...', summary: 'Math test covers fractions and decimals. Bring a ruler.', detected: 'Event · Tuesday, 10:30 AM', category: 'Announcements', needsAction: false, childId: 'aarav' },
  { id: 'm5', sender: 'School App', snippet: 'Please review and submit the permission form for the September trip.', summary: 'Permission slip needs a parent signature before Thursday.', detected: 'Task · due Thursday', category: 'Needs Action', needsAction: true, childId: 'aarav' },
  { id: 'm6', sender: 'Emma’s Class', snippet: 'This week in Year 3: reading logs and an English worksheet...', summary: 'Emma has an English worksheet to finish by Wednesday evening.', detected: 'Task · due Wednesday', category: 'Homework', needsAction: true, childId: 'emma' },
];

const initialSources: Source[] = [
  { id: 'email', name: 'Email', status: 'Connected', detail: 'School newsletters & teacher notes', lastSync: 'Synced 14 min ago' },
  { id: 'whatsapp', name: 'WhatsApp', status: 'Connected', detail: '3 groups connected', lastSync: 'Synced 8 min ago', groups: ['Class 6A Parents', 'Greenwood Sports', 'School Announcements'] },
  { id: 'apps', name: 'School Apps', status: 'Connected', detail: '2 apps connected', lastSync: 'Synced 1 hr ago' },
  { id: 'calendar', name: 'Calendar', status: 'Connect', detail: 'Keep school dates in one place', lastSync: 'Not connected' },
  { id: 'documents', name: 'Documents', status: 'Connected', detail: '12 school PDFs processed', lastSync: 'Processed yesterday' },
];

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', icon: ListChecks },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'inbox', label: 'Inbox', icon: InboxIcon },
];

function IconText({ icon: Icon, children }: { icon: typeof Check; children: ReactNode }) {
  return <span className="inline-flex items-center gap-2"><Icon size={15} strokeWidth={1.8} />{children}</span>;
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#5148B8',
    colorForeground: '#20212B',
    colorMutedForeground: '#737482',
    colorDanger: '#C44B55',
    colorBackground: '#FFFEFC',
    colorInput: '#F8F7F3',
    colorInputForeground: '#20212B',
    colorNeutral: '#E5E3DE',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.9rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#FFFEFC] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#20212B]',
    headerSubtitle: 'text-[#737482]',
    socialButtonsBlockButtonText: 'text-[#20212B]',
    formFieldLabel: 'text-[#20212B]',
    footerActionLink: 'text-[#5148B8]',
    footerActionText: 'text-[#737482]',
    dividerText: 'text-[#737482]',
    identityPreviewEditButton: 'text-[#5148B8]',
    formFieldSuccessText: 'text-[#2B8A67]',
    alertText: 'text-[#C44B55]',
    logoBox: 'rounded-xl',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-[#E5E3DE] bg-[#F8F7F3]',
    formButtonPrimary: 'bg-[#5148B8] hover:bg-[#433A9F]',
    formFieldInput: 'border-[#E5E3DE] bg-[#F8F7F3] text-[#20212B]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#E5E3DE]',
    alert: 'border-[#F5D5D5] bg-[#FFF4F4]',
    otpCodeFieldInput: 'border-[#E5E3DE] bg-[#F8F7F3]',
    formFieldRow: 'text-[#20212B]',
    main: 'bg-transparent',
  },
};

function DashboardApp() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const parentName = user?.firstName || 'Sanjay';
  const [view, setView] = useState<View>('home');
  const [selectedChild, setSelectedChild] = useState<ChildId>('aarav');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<'science' | 'whatsapp' | 'assistant' | 'onboarding' | 'privacy' | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [inboxFilter, setInboxFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [planTab, setPlanTab] = useState('Today');
  const [calendarMode, setCalendarMode] = useState('Month');
  const [calendarChild, setCalendarChild] = useState<'all' | ChildId>('all');
  const [groupSelection, setGroupSelection] = useState<string[]>(['Class 6A Parents', 'Greenwood Sports']);
  const [calendarEvents, setCalendarEvents] = useState<EventItem[]>(events);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<Message[]>(messages);
  const [gmailSyncing, setGmailSyncing] = useState(false);

  const activeChild = children.find((child) => child.id === selectedChild) ?? children[0];
  useEffect(() => {
    void fetch('/api/me', { credentials: 'include' });
    void syncCalendar();
    void syncGmail();
  }, []);

  const syncCalendar = async () => {
    setCalendarSyncing(true);
    try {
      const response = await fetch('/api/calendar/events', { credentials: 'include' });
      if (!response.ok) throw new Error('Calendar sync failed');
      const payload = (await response.json()) as { items?: Array<{ id: string; summary?: string; htmlLink?: string; start?: { date?: string; dateTime?: string } }> };
      const liveEvents = (payload.items ?? []).map((event, index) => {
        const rawStart = event.start?.dateTime ?? event.start?.date;
        const date = rawStart ? new Date(rawStart) : new Date();
        const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
        return {
          id: event.id || `google-${index}`,
          title: event.summary || 'Untitled calendar event',
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          time: isAllDay ? 'All day' : date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
          childId: selectedChild,
          kind: 'Google Calendar',
          source: 'Google Calendar',
        } satisfies EventItem;
      });
      if (liveEvents.length > 0) setCalendarEvents(liveEvents);
      setSources((current) => current.map((source) => source.id === 'calendar' ? { ...source, status: 'Connected', detail: `${liveEvents.length} events synced`, lastSync: 'Synced just now' } : source));
      notify(liveEvents.length > 0 ? `${liveEvents.length} Google Calendar events synced` : 'Google Calendar is connected');
    } catch {
      notify('Calendar sync needs attention');
    } finally {
      setCalendarSyncing(false);
    }
  };
  const syncGmail = async () => {
    setGmailSyncing(true);
    try {
      const response = await fetch('/api/gmail/messages?pageSize=30', { credentials: 'include' });
      if (!response.ok) throw new Error('Gmail sync failed');
      const payload = (await response.json()) as { items?: Array<{ id: string; sender: string; subject: string; snippet: string; date: string; category: string; needsAction: boolean }> };
      const liveMessages = (payload.items ?? []).map((message, index) => ({
        id: message.id || `gmail-${index}`,
        sender: message.sender,
        snippet: message.snippet,
        summary: message.subject,
        detected: `${message.category} · ${new Date(message.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`,
        category: message.category,
        needsAction: message.needsAction,
        childId: 'aarav',
      } satisfies Message));
      if (liveMessages.length > 0) setInboxMessages(liveMessages);
      setSources((current) => current.map((source) => source.id === 'email' ? { ...source, status: 'Connected', detail: `${liveMessages.length} recent emails`, lastSync: 'Synced just now' } : source));
      notify(liveMessages.length > 0 ? `${liveMessages.length} Gmail threads synced` : 'Gmail is connected');
    } catch {
      notify('Gmail sync needs attention');
    } finally {
      setGmailSyncing(false);
    }
  };
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };
  const completeTask = (id: string) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: task.status === 'completed' ? 'open' : 'completed' } : task));
    notify(tasks.find((task) => task.id === id)?.status === 'completed' ? 'Task moved back to your plan' : 'Nice work — task completed');
  };
  const addTask = (id: string) => {
    const task = tasks.find((item) => item.id === id);
    if (task && task.status === 'completed') setTasks((current) => current.map((item) => item.id === id ? { ...item, status: 'open' } : item));
    notify('Added to your plan');
  };
  const switchSource = (id: string) => {
    setSources((current) => current.map((source) => source.id === id ? { ...source, status: source.status === 'Connected' ? 'Connect' : 'Connected', detail: source.id === 'whatsapp' ? (source.status === 'Connected' ? 'Connect groups to continue' : '3 groups connected') : source.detail, lastSync: source.status === 'Connected' ? 'Not connected' : 'Synced just now' } : source));
    notify(sources.find((source) => source.id === id)?.status === 'Connected' ? 'Source disconnected' : 'Source connected');
  };

  const content = useMemo(() => {
    if (view === 'home') return <HomeView tasks={tasks} activeChild={activeChild} onOpenScience={() => setModal('science')} onOpenTask={setDetailTask} onAddTask={addTask} onAsk={() => setModal('assistant')} onView={(next) => setView(next)} />;
    if (view === 'plan') return <PlanView tasks={tasks} selectedChild={selectedChild} tab={planTab} setTab={setPlanTab} filter={planFilter} setFilter={setPlanFilter} onComplete={completeTask} onOpenTask={setDetailTask} onAsk={() => setModal('assistant')} />;
    if (view === 'calendar') return <CalendarView selectedChild={selectedChild} eventsData={calendarEvents} mode={calendarMode} setMode={setCalendarMode} child={calendarChild} setChild={setCalendarChild} onOpenEvent={setDetailEvent} />;
    if (view === 'inbox') return <InboxView messagesData={inboxMessages} gmailSyncing={gmailSyncing} onSyncGmail={syncGmail} filter={inboxFilter} setFilter={setInboxFilter} onOpenScience={() => setModal('science')} onAddTask={addTask} />;
    if (view === 'sources') return <SourcesView sources={sources} onSwitch={switchSource} onSyncCalendar={syncCalendar} calendarSyncing={calendarSyncing} onSyncGmail={syncGmail} gmailSyncing={gmailSyncing} onWhatsApp={() => setModal('whatsapp')} onNotify={notify} />;
    if (view === 'profile') return <ProfileView child={activeChild} tasks={tasks} eventsData={calendarEvents} onSelect={setSelectedChild} onOpenTask={setDetailTask} onAdd={() => { setOnboardingStep(1); setModal('onboarding'); }} onNotify={notify} />;
    return <SettingsView onNotify={notify} onOpenPrivacy={() => setModal('privacy')} onSources={() => setView('sources')} onOnboarding={() => { setOnboardingStep(0); setModal('onboarding'); }} />;
  }, [activeChild, calendarChild, calendarMode, gmailSyncing, inboxFilter, inboxMessages, inboxFilter, planFilter, planTab, selectedChild, sources, tasks, view]);

  return (
    <div className="sl-app">
      <Sidebar view={view} setView={setView} selectedChild={selectedChild} setSelectedChild={setSelectedChild} parentName={parentName} onSignOut={() => void signOut({ redirectUrl: basePath || '/' })} />
      <div className="sl-main">
        <header className="sl-mobile-top">
          <button className="sl-icon-button" data-testid="button-mobile-menu" onClick={() => notify('Use More to explore SchoolLife')}><Menu size={19} /></button>
          <button className="sl-wordmark" data-testid="button-mobile-home" onClick={() => setView('home')}><span className="sl-mark">S</span> SchoolLife</button>
          <button className="sl-icon-button" data-testid="button-notifications-mobile" onClick={() => notify('You’re all caught up')}><Bell size={18} /></button>
        </header>
        <main className="sl-content">
          <div className="sl-page-enter">{content}</div>
        </main>
      </div>
      <MobileNav view={view} setView={setView} />
      {detailTask && <TaskDetail task={detailTask} onClose={() => setDetailTask(null)} onComplete={() => { completeTask(detailTask.id); setDetailTask(null); }} onNotify={notify} />}
      {detailEvent && <EventDetail event={detailEvent} onClose={() => setDetailEvent(null)} onNotify={notify} />}
      {modal === 'science' && <ExtractionModal onClose={() => setModal(null)} onAdd={() => { addTask('science'); setModal(null); }} />}
      {modal === 'assistant' && <AssistantModal onClose={() => setModal(null)} onViewPlan={() => { setModal(null); setView('plan'); }} />}
      {modal === 'whatsapp' && <WhatsAppModal selected={groupSelection} setSelected={setGroupSelection} onClose={() => setModal(null)} onSave={() => { setModal(null); notify(`${groupSelection.length} WhatsApp groups connected`); }} />}
      {modal === 'privacy' && <PrivacyModal onClose={() => setModal(null)} onNotify={notify} />}
      {modal === 'onboarding' && <OnboardingModal step={onboardingStep} setStep={setOnboardingStep} onClose={() => setModal(null)} onFinish={() => { setModal(null); notify('Aarav is ready — welcome to SchoolLife'); }} />}
      {toast && <div className="sl-toast" data-testid="status-toast"><CheckCircle2 size={17} /> {toast}</div>}
    </div>
  );
}

function Sidebar({ view, setView, selectedChild, setSelectedChild, parentName, onSignOut }: { view: View; setView: (v: View) => void; selectedChild: ChildId; setSelectedChild: (v: ChildId) => void; parentName: string; onSignOut: () => void }) {
  return <aside className="sl-sidebar">
    <button className="sl-brand" data-testid="button-brand" onClick={() => setView('home')}><span className="sl-mark">S</span><span>SchoolLife</span></button>
    <div className="sl-side-label">Workspace</div>
    <nav className="sl-side-nav">{navItems.map((item) => <button key={item.id} className={`sl-side-link ${view === item.id ? 'active' : ''}`} data-testid={`button-nav-${item.id}`} onClick={() => setView(item.id)}><item.icon size={18} /> {item.label}{item.id === 'inbox' && <span className="sl-nav-count">12</span>}</button>)}</nav>
    <div className="sl-side-label sl-side-label-child">Your family</div>
    <button className={`sl-child-link ${selectedChild === 'aarav' && view === 'profile' ? 'active' : ''}`} data-testid="button-child-aarav" onClick={() => { setSelectedChild('aarav'); setView('profile'); }}><span className="sl-avatar avatar-indigo">AK</span><span><strong>Aarav</strong><small>Grade 6 · Class 6A</small></span></button>
    <button className={`sl-child-link ${selectedChild === 'emma' && view === 'profile' ? 'active' : ''}`} data-testid="button-child-emma" onClick={() => { setSelectedChild('emma'); setView('profile'); }}><span className="sl-avatar avatar-peach">EK</span><span><strong>Emma</strong><small>Grade 3 · Class 3B</small></span></button>
    <div className="sl-sidebar-bottom"><button className={`sl-side-link ${view === 'sources' ? 'active' : ''}`} data-testid="button-nav-sources" onClick={() => setView('sources')}><Zap size={18} /> Sources</button><button className={`sl-side-link ${view === 'settings' ? 'active' : ''}`} data-testid="button-nav-settings" onClick={() => setView('settings')}><SettingsIcon size={18} /> Settings</button><button className="sl-user" data-testid="button-sign-out" onClick={onSignOut}><span className="sl-avatar avatar-sanjay">{parentName.slice(0, 2).toUpperCase()}</span><span><strong>{parentName}</strong><small>Sign out</small></span><ChevronDown size={15} /></button></div>
  </aside>;
}

function MobileNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  const items: { id: View; label: string; icon: typeof LayoutDashboard }[] = [...navItems, { id: 'settings', label: 'More', icon: MoreHorizontal }];
  return <nav className="sl-mobile-nav">{items.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} data-testid={`button-mobile-nav-${item.id}`} onClick={() => setView(item.id)}><item.icon size={19} /><span>{item.label}</span>{item.id === 'inbox' && <i>12</i>}</button>)}</nav>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="sl-page-header"><div><div className="sl-eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function HomeView({ tasks, activeChild, onOpenScience, onOpenTask, onAddTask, onAsk, onView }: { tasks: Task[]; activeChild: Child; onOpenScience: () => void; onOpenTask: (task: Task) => void; onAddTask: (id: string) => void; onAsk: () => void; onView: (v: View) => void }) {
  const openTasks = tasks.filter((task) => task.status === 'open');
  return <div>
    <div className="sl-home-head"><div><div className="sl-eyebrow">Monday, September 8, 2026</div><h1>Good morning, Sanjay <span className="sl-sun">✦</span></h1><p>Here’s what matters today.</p></div><button className="sl-notification" data-testid="button-notifications" onClick={() => onAsk()}><Bell size={18} /><span>1</span></button></div>
    <div className="sl-home-grid">
      <section className="sl-attention-card"><div className="sl-card-kicker"><span className="sl-status-dot urgent"></span> Needs attention <span className="sl-soft-badge">1 item</span></div><div className="sl-attention-body"><div className="sl-urgent-icon"><ClipboardCheck size={21} /></div><div className="sl-attention-copy"><span className="sl-priority">URGENT</span><h2>Science project due tomorrow</h2><p>Aarav · Class 6A <span className="dot-sep">·</span> Tomorrow, 8:00 PM</p><small><MessageCircle size={13} /> Class 6A Parents WhatsApp</small></div><button className="sl-text-button" data-testid="button-view-science" onClick={onOpenScience}>View details <ChevronRight size={15} /></button></div></section>
      <div className="sl-today-card sl-card"><div className="sl-card-title-row"><div><div className="sl-eyebrow">Today</div><h2>Monday rhythm</h2></div><span className="sl-date-pill">SEP 08</span></div><div className="sl-timeline">{[['08:00','School starts','School'],['10:30','Math test','Class 6A'],['16:00','Football practice','Sports'],['18:00','Submit science project','Home']].map(([time,title,type], index) => <div className="sl-time-row" key={title}><span className="sl-time">{time}</span><span className={`sl-time-marker marker-${index}`}></span><div><strong>{title}</strong><small>{type}</small></div></div>)}</div><button className="sl-full-button" data-testid="button-open-calendar" onClick={() => onView('calendar')}>Open calendar <ChevronRight size={15} /></button></div>
      <div className="sl-week-card sl-card"><div className="sl-card-title-row"><div><div className="sl-eyebrow">This week</div><h2>Keep it moving</h2></div><button className="sl-more" data-testid="button-week-more" onClick={() => onView('plan')}><MoreHorizontal size={18} /></button></div><div className="sl-week-list">{[['English worksheet','Emma','Wed'],['Parent-teacher meeting','Aarav','Thu'],['₹1,250 school trip payment','Aarav','Fri'],['Bring sports uniform','Aarav','Sat']].map(([title, child, date]) => <button key={title} className="sl-week-item" data-testid={`button-week-${date}`} onClick={() => onView('plan')}><span className="sl-mini-check"><Circle size={16} /></span><span><strong>{title}</strong><small>{child}</small></span><time>{date}</time></button>)}</div></div>
      <div className="sl-update-card sl-card"><div className="sl-card-title-row"><div><div className="sl-eyebrow">School updates</div><h2>We spotted a pattern</h2></div><Sparkles size={19} className="sl-sparkle" /></div><div className="sl-update-art"><div className="sl-paper-lines"></div><span>FRI<br />AI detected</span></div><p>Chart paper and sketch pens are mentioned across two Class 6A messages.</p><button className="sl-secondary-button" data-testid="button-add-school-update" onClick={() => onAddTask('chart-paper')}><Plus size={15} /> Add to plan</button></div>
      <div className="sl-digest-card sl-card"><div className="sl-card-title-row"><div><div className="sl-eyebrow">Daily digest</div><h2>7 new items, sorted</h2></div><span className="sl-digest-count">3</span></div><p>SchoolLife turned today’s school noise into three clear next steps.</p><div className="sl-digest-items"><span><span className="digest-icon green"><Check size={13} /></span> 2 events</span><span><span className="digest-icon amber"><Clock3 size={13} /></span> 3 tasks</span><span><span className="digest-icon blue"><FileText size={13} /></span> 2 updates</span></div><button className="sl-text-button" data-testid="button-open-inbox" onClick={() => onView('inbox')}>Review inbox <ChevronRight size={15} /></button></div>
    </div>
    <AssistantBar onAsk={onAsk} />
    <div className="sl-home-footer"><span><ShieldCheck size={15} /> Your school information stays in your control.</span><button data-testid="button-manage-sources" onClick={() => onView('sources')}>Manage sources</button><span className="sl-quiet-count">{openTasks.length} open items for {activeChild.name.split(' ')[0]}</span></div>
  </div>;
}

function AssistantBar({ onAsk }: { onAsk: () => void }) {
  return <button className="sl-assistant-bar" data-testid="button-ask-schoollife" onClick={onAsk}><span className="sl-assistant-icon"><Sparkles size={17} /></span><span><strong>Ask SchoolLife</strong><small>Try “What do I need to handle this week?”</small></span><Send size={17} /></button>;
}

function PlanView({ tasks, selectedChild, tab, setTab, filter, setFilter, onComplete, onOpenTask, onAsk }: { tasks: Task[]; selectedChild: ChildId; tab: string; setTab: (v: string) => void; filter: string; setFilter: (v: string) => void; onComplete: (id: string) => void; onOpenTask: (task: Task) => void; onAsk: () => void }) {
  const filters = ['All', 'Payments', 'Homework', 'Events', 'Shopping', 'Permission'];
  const filtered = tasks.filter((task) => (tab === 'Completed' ? task.status === 'completed' : tab === 'Later' ? task.dueDate === 'Sep 12' : task.status === 'open')).filter((task) => filter === 'All' || task.kind === filter).filter((task) => selectedChild === 'aarav' ? true : task.childId === selectedChild);
  return <div><PageHeader eyebrow="Family command center" title="Your Plan" description="A calm view of the things school needs from your family." action={<button className="sl-primary-button" data-testid="button-add-plan" onClick={() => onOpenTask(tasks[0])}><Plus size={16} /> Add to plan</button>} /><div className="sl-tabs">{['Today', 'This Week', 'Later', 'Completed'].map((item) => <button key={item} className={tab === item ? 'active' : ''} data-testid={`button-plan-tab-${item.toLowerCase().replace(' ', '-')}`} onClick={() => setTab(item)}>{item}{item === 'Completed' && <span>2</span>}</button>)}</div><div className="sl-filter-row"><span className="sl-filter-label"><Filter size={14} /> Filter</span>{filters.map((item) => <button key={item} className={filter === item ? 'selected' : ''} data-testid={`button-plan-filter-${item.toLowerCase()}`} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="sl-plan-layout"><div className="sl-task-list">{filtered.map((task) => <TaskRow key={task.id} task={task} onComplete={onComplete} onOpen={() => onOpenTask(task)} />)}{filtered.length === 0 && <EmptyState icon={<CheckCircle2 />} title="Nothing here yet" copy="New school messages will land in the right place automatically." />}</div><aside className="sl-plan-summary"><div className="sl-eyebrow">Plan pulse</div><strong>{tasks.filter((task) => task.status === 'open').length} <small>open items</small></strong><div className="sl-progress"><span style={{ width: '34%' }}></span></div><p>2 items due in the next 48 hours</p><div className="sl-summary-line"><span className="sl-dot dot-red"></span> 1 urgent</div><div className="sl-summary-line"><span className="sl-dot dot-amber"></span> 2 important</div><div className="sl-summary-line"><span className="sl-dot dot-green"></span> 3 on track</div></aside></div><AssistantBar onAsk={onAsk} /></div>;
}

function TaskRow({ task, onComplete, onOpen }: { task: Task; onComplete: (id: string) => void; onOpen: () => void }) {
  return <div className={`sl-task-row ${task.status === 'completed' ? 'is-complete' : ''}`} data-testid={`card-task-${task.id}`}><button className="sl-task-check" data-testid={`button-complete-${task.id}`} onClick={() => onComplete(task.id)}>{task.status === 'completed' ? <Check size={14} /> : <Circle size={19} />}</button><button className="sl-task-main" data-testid={`button-open-task-${task.id}`} onClick={onOpen}><span className={`sl-priority-pill ${task.priority}`}>{task.priority}</span><strong>{task.title}</strong><div className="sl-task-meta"><span>{task.childId === 'aarav' ? 'Aarav' : 'Emma'}</span><span>{task.dueDate} {task.dueTime && `· ${task.dueTime}`}</span><span>{task.source}</span></div></button><button className="sl-row-chevron" data-testid={`button-task-details-${task.id}`} onClick={onOpen}><ChevronRight size={17} /></button></div>;
}

function CalendarView({ selectedChild, eventsData, mode, setMode, child, setChild, onOpenEvent }: { selectedChild: ChildId; eventsData: EventItem[]; mode: string; setMode: (v: string) => void; child: 'all' | ChildId; setChild: (v: 'all' | ChildId) => void; onOpenEvent: (event: EventItem) => void }) {
  const visibleEvents = eventsData.filter((event) => child === 'all' || event.childId === child);
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return <div><PageHeader eyebrow="School rhythm" title="Calendar" description="One view for every date your family needs to remember." action={<div className="sl-view-toggle">{['Month', 'Week', 'Agenda'].map((item) => <button key={item} className={mode === item ? 'active' : ''} data-testid={`button-calendar-${item.toLowerCase()}`} onClick={() => setMode(item)}>{item}</button>)}</div>} /><div className="sl-calendar-toolbar"><div className="sl-month-switch"><button data-testid="button-calendar-prev" onClick={() => {}}><ChevronLeft size={17} /></button><strong>September 2026</strong><button data-testid="button-calendar-next" onClick={() => {}}><ChevronRight size={17} /></button></div><div className="sl-child-toggle">{[['all', 'All children'], ['aarav', 'Aarav'], ['emma', 'Emma']].map(([id, label]) => <button key={id} className={child === id ? 'active' : ''} data-testid={`button-calendar-child-${id}`} onClick={() => setChild(id as 'all' | ChildId)}>{label}</button>)}</div></div>{mode === 'Agenda' ? <div className="sl-agenda">{visibleEvents.map((event) => <EventRow event={event} key={event.id} onOpen={onOpenEvent} />)}</div> : mode === 'Week' ? <div className="sl-week-calendar">{visibleEvents.slice(0, 5).map((event) => <EventRow event={event} key={event.id} onOpen={onOpenEvent} />)}</div> : <div className="sl-calendar-grid"><div className="sl-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div><div className="sl-days">{days.map((day) => { const dayEvents = visibleEvents.filter((event) => Number(event.date.split(' ')[1]) === day); return <div className={`sl-day ${day === 8 ? 'today' : ''}`} key={day}><span>{day}</span>{dayEvents.map((event) => <button key={event.id} className={`sl-calendar-event ${event.kind === 'Deadline' ? 'urgent' : ''}`} data-testid={`button-calendar-event-${event.id}`} onClick={() => onOpenEvent(event)}>{event.title}</button>)}</div>; })}</div></div>}<div className="sl-calendar-legend"><span><i className="legend-dot purple"></i> Aarav</span><span><i className="legend-dot peach"></i> Emma</span><span><i className="legend-dot amber"></i> Important</span></div></div>;
}

function EventRow({ event, onOpen }: { event: EventItem; onOpen: (event: EventItem) => void }) {
  return <button className="sl-event-row" data-testid={`button-event-${event.id}`} onClick={() => onOpen(event)}><span className="sl-event-date">{event.date.replace('Sep ', '')}<small>SEP</small></span><span className="sl-event-line"></span><span className="sl-event-copy"><strong>{event.title}</strong><small>{event.time} · {event.childId === 'aarav' ? 'Aarav' : 'Emma'} · {event.source}</small></span><ChevronRight size={17} /></button>;
}

function InboxView({ messagesData, gmailSyncing, onSyncGmail, filter, setFilter, onOpenScience, onAddTask }: { messagesData: Message[]; gmailSyncing: boolean; onSyncGmail: () => void; filter: string; setFilter: (v: string) => void; onOpenScience: () => void; onAddTask: (id: string) => void }) {
  const filters = ['All', 'Needs Action', 'Events', 'Payments', 'Homework', 'Announcements'];
  const shown = messagesData.filter((message) => filter === 'All' || (filter === 'Needs Action' ? message.needsAction : message.category === filter));
  return <div><PageHeader eyebrow="The noise, resolved" title="Inbox" description={`${messagesData.length} recent school-related items, translated into what matters.`} action={<div className="sl-page-actions"><button className="sl-secondary-button" data-testid="button-sync-gmail" onClick={onSyncGmail}><RefreshCw size={15} className={gmailSyncing ? 'sl-spin' : ''} /> {gmailSyncing ? 'Syncing…' : 'Sync Gmail'}</button><button className="sl-secondary-button" data-testid="button-mark-read" onClick={() => {}}><Check size={15} /> Mark all read</button></div>} /><div className="sl-filter-row inbox-filters">{filters.map((item) => <button key={item} className={filter === item ? 'selected' : ''} data-testid={`button-inbox-filter-${item.toLowerCase().replace(' ', '-')}`} onClick={() => setFilter(item)}>{item}{item === 'Needs Action' && <span className="filter-count">{messagesData.filter((message) => message.needsAction).length}</span>}</button>)}</div><div className="sl-inbox-list">{shown.map((message) => <MessageCard message={message} key={message.id} onOpen={message.id === 'm1' ? onOpenScience : () => {}} onAdd={() => onAddTask(message.id === 'm1' ? 'science' : message.id === 'm2' ? 'trip-fee' : 'permission')} />)}</div>{shown.length === 0 && <div className="sl-empty-state"><Mail size={20} /><strong>No {filter.toLowerCase()} items yet</strong><span>Try another filter or sync Gmail again.</span></div>}</div>;
}

function MessageCard({ message, onOpen, onAdd }: { message: Message; onOpen: () => void; onAdd: () => void }) {
  return <article className="sl-message-card" data-testid={`card-message-${message.id}`}><div className="sl-message-top"><span className={`sl-source-icon ${message.sender.includes('WhatsApp') || message.sender.includes('Parents') ? 'whatsapp' : message.sender.includes('Teacher') ? 'teacher' : 'school'}`}>{message.sender.includes('Parents') ? <MessageCircle size={15} /> : message.sender.includes('Teacher') ? <GraduationCap size={15} /> : <Mail size={15} />}</span><div><strong>{message.sender}</strong><small>Today · 09:18 AM</small></div>{message.needsAction && <span className="sl-action-badge">Needs action</span>}<button className="sl-more" data-testid={`button-message-more-${message.id}`} onClick={() => {}}><MoreHorizontal size={17} /></button></div><p className="sl-snippet">“{message.snippet}”</p><div className="sl-ai-summary"><span><Sparkles size={14} /> SchoolLife understood</span><strong>{message.summary}</strong><small><Tag size={13} /> {message.detected}</small></div><div className="sl-message-actions"><button className="sl-text-button" data-testid={`button-view-message-${message.id}`} onClick={onOpen}>View original <ChevronRight size={14} /></button>{message.needsAction && <button className="sl-secondary-button compact" data-testid={`button-add-message-${message.id}`} onClick={onAdd}><Plus size={14} /> Add to plan</button>}</div></article>;
}

function SourcesView({ sources, onSwitch, onSyncCalendar, calendarSyncing, onSyncGmail, gmailSyncing, onWhatsApp, onNotify }: { sources: Source[]; onSwitch: (id: string) => void; onSyncCalendar: () => void; calendarSyncing: boolean; onSyncGmail: () => void; gmailSyncing: boolean; onWhatsApp: () => void; onNotify: (msg: string) => void }) {
  const syncSource = (source: Source) => {
    if (source.id === 'calendar') return onSyncCalendar();
    if (source.id === 'email') return onSyncGmail();
    onNotify(`${source.name} synced just now`);
  };
  const connectSource = (source: Source) => {
    if (source.status === 'Connected') return onSwitch(source.id);
    if (source.id === 'calendar') return onSyncCalendar();
    if (source.id === 'email') return onSyncGmail();
    onSwitch(source.id);
  };

  return <div><PageHeader eyebrow="Your connections" title="Sources" description="SchoolLife brings everything together without taking control away." action={<button className="sl-primary-button" data-testid="button-sync-all" onClick={() => { onSyncCalendar(); onSyncGmail(); onNotify('Syncing connected sources'); }}><RefreshCw size={15} /> Sync all</button>} /><div className="sl-trust-banner"><span className="sl-trust-icon"><ShieldCheck size={19} /></span><div><strong>You control what SchoolLife can access.</strong><p>Change permissions or disconnect a source any time. We only process what you choose to share.</p></div><button data-testid="button-source-permissions" onClick={() => onNotify('Permissions are up to date')}>Manage permissions</button></div><div className="sl-source-list">{sources.map((source) => <div className="sl-source-row" key={source.id} data-testid={`row-source-${source.id}`}><span className={`sl-source-logo source-${source.id}`}>{source.id === 'email' ? <Mail size={19} /> : source.id === 'whatsapp' ? <MessageCircle size={19} /> : source.id === 'apps' ? <Zap size={19} /> : source.id === 'calendar' ? <CalendarDays size={19} /> : <FileText size={19} />}</span><div className="sl-source-info"><strong>{source.name}</strong><span>{source.detail}</span><small>{source.lastSync}</small></div><span className={`sl-connected ${source.status === 'Connected' ? 'yes' : ''}`}><span></span>{source.status}</span>{source.id === 'whatsapp' && source.status === 'Connected' ? <button className="sl-secondary-button compact" data-testid="button-manage-whatsapp" onClick={onWhatsApp}>Manage</button> : <button className="sl-secondary-button compact" data-testid={`button-source-${source.status === 'Connected' ? 'disconnect' : 'connect'}-${source.id}`} onClick={() => connectSource(source)}>{(calendarSyncing && source.id === 'calendar') || (gmailSyncing && source.id === 'email') ? 'Syncing…' : source.status === 'Connected' ? 'Disconnect' : 'Sync'}</button>}{source.status === 'Connected' && source.id !== 'whatsapp' && <button className="sl-source-sync" data-testid={`button-sync-${source.id}`} onClick={() => syncSource(source)}><RefreshCw size={15} className={(calendarSyncing && source.id === 'calendar') || (gmailSyncing && source.id === 'email') ? 'sl-spin' : ''} /></button>}</div>)}</div><div className="sl-docs-note"><Paperclip size={16} /><span><strong>Documents</strong> can process school PDFs, timetables, and circulars. You’ll see a summary before anything is added to your plan.</span></div></div>;
}

function ProfileView({ child, tasks, eventsData, onSelect, onOpenTask, onAdd, onNotify }: { child: Child; tasks: Task[]; eventsData: EventItem[]; onSelect: (id: ChildId) => void; onOpenTask: (task: Task) => void; onAdd: () => void; onNotify: (message: string) => void }) {
  const childTasks = tasks.filter((task) => task.childId === child.id && task.status === 'open');
  return <div><PageHeader eyebrow="Family profile" title={child.name} description="A focused view of one child’s school rhythm." action={<button className="sl-secondary-button" data-testid="button-add-child" onClick={onAdd}><Plus size={15} /> Add another child</button>} /><div className="sl-profile-switch"><span>Viewing</span>{children.map((item) => <button key={item.id} className={item.id === child.id ? 'active' : ''} data-testid={`button-profile-switch-${item.id}`} onClick={() => onSelect(item.id)}><span className={`sl-avatar ${item.id === 'aarav' ? 'avatar-indigo' : 'avatar-peach'}`}>{item.name.slice(0, 2).toUpperCase()}</span>{item.name.split(' ')[0]}</button>)}</div><div className="sl-profile-grid"><section className="sl-profile-hero"><span className={`sl-avatar large ${child.id === 'aarav' ? 'avatar-indigo' : 'avatar-peach'}`}>{child.name.slice(0, 2).toUpperCase()}</span><div><h2>{child.name}</h2><p>{child.grade} <span>·</span> {child.className}</p><small>{child.school}</small></div><button className="sl-more" data-testid="button-profile-more" onClick={() => onNotify('Profile details are up to date')}><MoreHorizontal size={18} /></button></section><section className="sl-profile-card sl-card"><div className="sl-eyebrow">Upcoming</div><h2>School rhythm</h2>{eventsData.filter((event) => event.childId === child.id).slice(0, 3).map((event) => <EventRow key={event.id} event={event} onOpen={() => onNotify(`${event.title} is ${event.date} at ${event.time}`)} />)}</section><section className="sl-profile-card sl-card"><div className="sl-eyebrow">Tasks</div><h2>{childTasks.length} open for {child.name.split(' ')[0]}</h2>{childTasks.slice(0, 4).map((task) => <button className="sl-profile-task" key={task.id} data-testid={`button-profile-task-${task.id}`} onClick={() => onOpenTask(task)}><span className={`sl-priority-dot ${task.priority}`}></span><span>{task.title}<small>{task.dueDate} · {task.kind}</small></span><ChevronRight size={15} /></button>)}</section><section className="sl-subjects-card sl-card"><div className="sl-eyebrow">Subjects</div><h2>What {child.name.split(' ')[0]} is learning</h2><div className="sl-subject-grid">{child.subjects.map((subject, index) => <span key={subject}><i className={`subject-icon subject-${index}`}><GraduationCap size={14} /></i>{subject}</span>)}</div></section></div></div>;
}

function SettingsView({ onNotify, onOpenPrivacy, onSources, onOnboarding }: { onNotify: (msg: string) => void; onOpenPrivacy: () => void; onSources: () => void; onOnboarding: () => void }) {
  return <div><PageHeader eyebrow="The details" title="Settings" description="Make SchoolLife fit the way your family works." /><div className="sl-settings-layout"><div className="sl-settings-nav">{['Account', 'Children', 'Connected Sources', 'Notifications', 'Privacy', 'AI Preferences'].map((item, index) => <button key={item} className={index === 0 ? 'active' : ''} data-testid={`button-settings-${item.toLowerCase().replace(' ', '-')}`} onClick={() => item === 'Connected Sources' ? onSources() : item === 'Privacy' ? onOpenPrivacy() : onNotify(`${item} settings are ready to customise`)}>{item}<ChevronRight size={15} /></button>)}</div><section className="sl-settings-content"><div className="sl-settings-card"><div className="sl-settings-heading"><span className="sl-avatar avatar-sanjay">SK</span><div><h2>Sanjay Kundu</h2><p>sanjay.kundu@example.com</p></div><button className="sl-secondary-button compact" data-testid="button-edit-account" onClick={() => onNotify('Account details are up to date')}>Edit</button></div></div><div className="sl-settings-card"><div className="sl-eyebrow">Privacy</div><h2>You control your data</h2><p>SchoolLife keeps processed school information on this device for your family only.</p><div className="sl-setting-actions"><button data-testid="button-manage-permissions" onClick={onOpenPrivacy}><ShieldCheck size={15} /> Manage permissions</button><button data-testid="button-delete-data" onClick={() => onNotify('Processed data cleared from this device')}><Trash2 size={15} /> Delete processed data</button><button data-testid="button-disconnect-sources" onClick={onSources}><X size={15} /> Disconnect sources</button></div></div><div className="sl-settings-card"><div className="sl-eyebrow">Getting started</div><h2>Want to revisit setup?</h2><p>Add a child or connect a new school source in a few quiet steps.</p><button className="sl-secondary-button" data-testid="button-run-onboarding" onClick={onOnboarding}>Run setup again <ChevronRight size={15} /></button></div></section></div></div>;
}

function EmptyState({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className="sl-empty-state">{icon}<h3>{title}</h3><p>{copy}</p></div>;
}

function Overlay({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="sl-overlay" role="dialog"><div className={`sl-modal ${wide ? 'wide' : ''}`}><button className="sl-modal-close" data-testid="button-modal-close" onClick={onClose}><X size={18} /></button>{children}</div></div>;
}

function ExtractionModal({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  return <Overlay onClose={onClose} wide><div className="sl-extraction-grid"><div className="sl-original-message"><div className="sl-modal-eyebrow"><MessageCircle size={14} /> Original message</div><div className="sl-chat-bubble"><strong>Class 6A Parents</strong><small>Today, 09:18 AM</small><p>Reminder everyone — science activity is this Friday. Children need to bring a project on “How plants adapt”. Please use blue chart paper or a file, add printed research, and submit by Wednesday 8 PM. Sketch pens would help make it colourful.</p></div><button className="sl-text-button" data-testid="button-view-original"><Paperclip size={14} /> View original message</button></div><div className="sl-understood"><div className="sl-modal-eyebrow"><Sparkles size={14} /> SchoolLife understood</div><h2>From a message to a plan.</h2><div className="sl-extracted-list"><Extracted icon={<ListChecks />} label="TASK" value="Submit science project" /><Extracted icon={<Clock3 />} label="DEADLINE" value="Wednesday · 8 PM" /><Extracted icon={<CalendarDays />} label="EVENT" value="Science activity · Friday" /><Extracted icon={<ShoppingBagIcon />} label="REQUIRED ITEMS" value="Blue chart paper, sketch pens, project materials" /><Extracted icon={<UserRound />} label="CHILD" value="Aarav · Class 6A" /></div><div className="sl-confidence"><span><CheckCircle2 size={15} /> Confidence <strong>High</strong></span><button className="sl-primary-button" data-testid="button-add-everything" onClick={onAdd}>Add everything to my plan <Plus size={15} /></button></div></div></div></Overlay>;
}

function ShoppingBagIcon() { return <Tag />; }
function Extracted({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="sl-extracted"><span className="sl-extracted-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function TaskDetail({ task, onClose, onComplete, onNotify }: { task: Task; onClose: () => void; onComplete: () => void; onNotify: (msg: string) => void }) {
  return <Overlay onClose={onClose}><div className="sl-detail-panel"><span className="sl-priority-pill urgent">URGENT</span><h2>{task.title}</h2><p className="sl-detail-sub"><span className="sl-avatar tiny avatar-indigo">AK</span> Aarav · Class 6A</p><div className="sl-detail-date"><CalendarDays size={16} /><strong>Sep 9 · 8:00 PM</strong><small>Due tomorrow</small></div><div className="sl-detail-section"><div className="sl-eyebrow">Bring along</div>{task.items.map((item) => <div className="sl-detail-item" key={item}><CheckCircle2 size={15} /> {item}</div>)}</div><div className="sl-detail-section"><div className="sl-eyebrow">Source</div><button className="sl-source-chip" data-testid="button-detail-source" onClick={() => onNotify('Opening Class 6A Parents WhatsApp') }><MessageCircle size={14} /> {task.source} <ChevronRight size={14} /></button></div><div className="sl-detail-actions"><button className="sl-primary-button" data-testid="button-detail-complete" onClick={onComplete}><Check size={16} /> Mark complete</button><button className="sl-secondary-button" data-testid="button-add-reminder" onClick={() => onNotify('Reminder set for tomorrow at 7:00 PM')}><Bell size={15} /> Add reminder</button><button className="sl-text-button" data-testid="button-detail-view-source" onClick={() => onNotify('Source preview opened')}><FileText size={15} /> View source</button></div></div></Overlay>;
}

function EventDetail({ event, onClose, onNotify }: { event: EventItem; onClose: () => void; onNotify: (msg: string) => void }) {
  return <Overlay onClose={onClose}><div className="sl-detail-panel event-detail"><span className="sl-event-type">{event.kind}</span><h2>{event.title}</h2><p className="sl-detail-sub"><span className="sl-avatar tiny avatar-indigo">AK</span> {event.childId === 'aarav' ? 'Aarav' : 'Emma'} · {event.source}</p><div className="sl-detail-date"><CalendarDays size={16} /><strong>{event.date} · {event.time}</strong><small>September 2026</small></div><div className="sl-detail-section"><div className="sl-eyebrow">SchoolLife note</div><p className="sl-event-note">This date was found in a school message and placed here for your family.</p></div><button className="sl-primary-button" data-testid="button-event-reminder" onClick={() => onNotify('Reminder added to your calendar')}><Bell size={15} /> Add reminder</button></div></Overlay>;
}

function AssistantModal({ onClose, onViewPlan }: { onClose: () => void; onViewPlan: () => void }) {
  return <Overlay onClose={onClose}><div className="sl-assistant-modal"><div className="sl-assistant-big"><Sparkles size={20} /></div><div className="sl-modal-eyebrow">SchoolLife assistant</div><h2>Here’s your week, in three moves.</h2><p className="sl-assistant-intro">Based on what came in today, these are the things worth your attention.</p><div className="sl-answer-list"><div><b>01</b><span><strong>Science project</strong><small>Wednesday · due at 8:00 PM</small></span></div><div><b>02</b><span><strong>Permission slip</strong><small>Thursday · signature needed</small></span></div><div><b>03</b><span><strong>School trip payment</strong><small>Friday · ₹1,250</small></span></div></div><button className="sl-primary-button full" data-testid="button-view-full-plan" onClick={onViewPlan}>View full plan <ChevronRight size={16} /></button></div></Overlay>;
}

function WhatsAppModal({ selected, setSelected, onClose, onSave }: { selected: string[]; setSelected: (groups: string[]) => void; onClose: () => void; onSave: () => void }) {
  const groups = ['Class 6A Parents', 'Greenwood Sports', 'School Announcements', 'Class 3B Parents'];
  return <Overlay onClose={onClose}><div className="sl-whatsapp-modal"><div className="sl-source-logo source-whatsapp big"><MessageCircle size={22} /></div><div className="sl-modal-eyebrow">WhatsApp connection</div><h2>Choose the groups to follow</h2><p>SchoolLife only reads messages from the groups you select. You can change this any time.</p><div className="sl-group-list">{groups.map((group) => <button className={`sl-group-choice ${selected.includes(group) ? 'selected' : ''}`} key={group} data-testid={`button-group-${group.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setSelected(selected.includes(group) ? selected.filter((item) => item !== group) : [...selected, group])}><span className="sl-check-square">{selected.includes(group) && <Check size={14} />}</span><span>{group}<small>{group.includes('6A') ? 'Greenwood International School' : 'Family group'}</small></span></button>)}</div><div className="sl-modal-actions"><button className="sl-secondary-button" data-testid="button-whatsapp-cancel" onClick={onClose}>Cancel</button><button className="sl-primary-button" data-testid="button-save-whatsapp" onClick={onSave}>Save selection</button></div></div></Overlay>;
}

function PrivacyModal({ onClose, onNotify }: { onClose: () => void; onNotify: (msg: string) => void }) {
  return <Overlay onClose={onClose}><div className="sl-privacy-modal"><div className="sl-trust-icon large"><ShieldCheck size={22} /></div><div className="sl-modal-eyebrow">Your privacy</div><h2>You control your data.</h2><p>SchoolLife is designed around your permission. Your sources stay yours, and every processed item can be removed from this device.</p><div className="sl-privacy-points"><span><CheckCircle2 size={15} /> Choose exactly which sources to connect</span><span><CheckCircle2 size={15} /> Review what SchoolLife understood</span><span><CheckCircle2 size={15} /> Delete processed data whenever you like</span></div><button className="sl-primary-button full" data-testid="button-privacy-done" onClick={() => { onClose(); onNotify('Your privacy settings are unchanged'); }}>Done</button></div></Overlay>;
}

function OnboardingModal({ step, setStep, onClose, onFinish }: { step: number; setStep: (step: number) => void; onClose: () => void; onFinish: () => void }) {
  const [addingAnother, setAddingAnother] = useState(false);
  return <Overlay onClose={onClose}><div className="sl-onboarding-modal">{step === 0 ? <><div className="sl-onboarding-mark"><Sparkles size={22} /></div><div className="sl-modal-eyebrow">A calmer school week</div><h2>School stuff, automatically organized.</h2><p>Connect the places school messages arrive, and SchoolLife will turn the noise into a clear family plan.</p><div className="sl-onboarding-lines"><span><Check size={14} /> One clear plan for every child</span><span><Check size={14} /> Helpful, not intrusive</span></div><button className="sl-primary-button full" data-testid="button-get-started" onClick={() => setStep(1)}>Get started <ChevronRight size={16} /></button></> : <><div className="sl-modal-eyebrow">Step 1 of 2 · Child setup</div><h2>Who are we organizing for?</h2><p>Add your child’s school details so every message lands in the right place.</p><div className="sl-setup-card"><span className="sl-avatar large avatar-indigo">AK</span><div><strong>Aarav Kundu</strong><span>Grade 6 · Class 6A</span><small>Greenwood International School</small></div><CheckCircle2 size={20} /></div>{addingAnother && <div className="sl-setup-card"><span className="sl-avatar large avatar-peach">EK</span><div><strong>Emma Kundu</strong><span>Grade 3 · Class 3B</span><small>Greenwood International School</small></div><CheckCircle2 size={20} /></div>}<button className="sl-add-child-row" data-testid="button-onboarding-add-child" onClick={() => setAddingAnother(true)}><Plus size={16} /> {addingAnother ? 'Another child added' : 'Add another child'}</button><button className="sl-primary-button full" data-testid="button-finish-setup" onClick={onFinish}>Continue to sources <ChevronRight size={16} /></button></>}</div></Overlay>;
}

function Landing() {
  return <main className="sl-landing">
    <div className="sl-landing-orb orb-one"></div>
    <div className="sl-landing-orb orb-two"></div>
    <div className="sl-landing-inner">
      <div className="sl-landing-nav"><button className="sl-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span className="sl-mark">S</span><span>SchoolLife</span></button><div className="sl-landing-actions"><a href="#how-it-works">How it works</a><a className="sl-secondary-button compact" href="/sign-in">Sign in</a><a className="sl-primary-button compact" href="/sign-up">Get started</a></div></div>
      <section className="sl-landing-hero">
        <div className="sl-landing-copy"><span className="sl-eyebrow">The calmer school week</span><h1>School stuff, <em>automatically organized.</em></h1><p>SchoolLife brings together school emails, messages and notices and turns them into one simple family plan.</p><div className="sl-landing-cta"><a className="sl-primary-button" href="/sign-up">Create your family plan <ChevronRight size={16} /></a><a className="sl-text-button" href="/sign-in">I already have an account <ChevronRight size={15} /></a></div><div className="sl-landing-trust"><span><ShieldCheck size={15} /> Your data stays in your control</span><span><Sparkles size={15} /> Built for busy families</span></div></div>
        <div className="sl-landing-preview"><div className="sl-preview-top"><span className="sl-mark">S</span><strong>Good morning</strong><span className="sl-preview-avatar">SK</span></div><div className="sl-preview-greeting">Here’s what matters today.</div><div className="sl-preview-alert"><span className="sl-preview-dot"></span><div><small>NEEDS ATTENTION</small><strong>Science project due tomorrow</strong><span>Aarav · Class 6A · 8:00 PM</span></div><ChevronRight size={16} /></div><div className="sl-preview-columns"><div><small>TODAY</small><strong>Monday rhythm</strong><span>08:00&nbsp;&nbsp; School starts</span><span>10:30&nbsp;&nbsp; Math test</span><span>16:00&nbsp;&nbsp; Football practice</span></div><div><small>THIS WEEK</small><strong>Keep it moving</strong><span>English worksheet</span><span>Parent-teacher meeting</span><span>₹1,250 trip payment</span></div></div><div className="sl-preview-bottom"><Sparkles size={15} /><span>7 new school items, sorted</span><ChevronRight size={15} /></div></div>
      </section>
      <section className="sl-landing-proof" id="how-it-works"><div><span className="sl-eyebrow">From noise to next steps</span><h2>Stop searching through five places to find one deadline.</h2></div><div className="sl-proof-steps"><div><span>01</span><strong>Connect your sources</strong><p>Email, calendars, school apps, and the places messages arrive.</p></div><div><span>02</span><strong>SchoolLife understands</strong><p>Important dates, tasks, payments, and required items are pulled out.</p></div><div><span>03</span><strong>Your family stays ahead</strong><p>Everything lands in one clear plan, organized by child and urgency.</p></div></div></section>
    </div>
  </main>;
}

function LoadingScreen() {
  return <div className="sl-auth-loading"><span className="sl-mark">S</span><strong>Preparing your family plan…</strong></div>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <Redirect to="/app" /> : <Landing />;
}

function ProtectedApp() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <DashboardApp /> : <Redirect to="/" />;
}

function SignInPage() {
  return <div className="sl-auth-page"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="sl-auth-page"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    routerPush={(to) => setLocation(to)}
    routerReplace={(to) => setLocation(to, { replace: true })}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your family plan' } },
      signUp: { start: { title: 'Create your family plan', subtitle: 'Start a calmer school week' } },
    }}
  >
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/app" component={ProtectedApp} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={HomeRedirect} />
    </Switch>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) {
    return <LoadingScreen />;
  }
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;