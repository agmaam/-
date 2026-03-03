import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Truck, 
  Car, 
  Container, 
  MapPin, 
  Navigation, 
  User, 
  Briefcase, 
  History, 
  Plus, 
  CheckCircle2, 
  Clock, 
  LogOut,
  ChevronRight,
  ShieldCheck,
  Phone,
  Map as MapIcon,
  X,
  Wallet,
  Award,
  FileText,
  Settings,
  HardHat,
  Globe,
  Lock,
  PieChart,
  Users,
  TrendingUp,
  Camera,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Booking, VehicleType, VEHICLE_DETAILS, UserProfile, CARGO_TYPES } from './types';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';

import { Toaster, toast } from 'sonner';

// Fix Leaflet marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const DRIVER_ICON = L.divIcon({
  html: `<div class="bg-orange-500 p-2 rounded-full border-2 border-white shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-2.18-2.725A1 1 0 0 0 18.82 9.5H15"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const PICKUP_ICON = L.divIcon({
  html: `<div class="bg-blue-500 p-2 rounded-full border-2 border-white shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const DROPOFF_ICON = L.divIcon({
  html: `<div class="bg-red-500 p-2 rounded-full border-2 border-white shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const socket: Socket = io();
const RIYADH_COORDS: [number, number] = [24.7136, 46.6753];

export default function App() {
  const [role, setRole] = useState<'customer' | 'driver' | 'admin' | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [view, setView] = useState<'dashboard' | 'wallet' | 'loyalty' | 'docs' | 'admin'>('dashboard');

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await fetch('/api/bookings');
        if (!res.ok) throw new Error('Failed to fetch bookings');
        const data = await res.json();
        setBookings(data);
      } catch (err) {
        toast.error(lang === 'ar' ? 'فشل في تحميل الطلبات' : 'Failed to load bookings');
      }
    };

    fetchBookings();

    socket.on('connect_error', () => {
      toast.error(lang === 'ar' ? 'فشل الاتصال بالخادم' : 'Connection to server failed');
    });

    socket.on('error', (err: any) => {
      toast.error(lang === 'ar' ? `خطأ في النظام: ${err.message}` : `System error: ${err.message}`);
    });

    socket.on('new_booking', (booking: Booking) => {
      setBookings(prev => [booking, ...prev]);
      if (role === 'driver') {
        toast.success(lang === 'ar' ? 'طلب جديد متاح!' : 'New request available!');
      }
    });

    socket.on('booking_updated', (updatedBooking: Booking) => {
      setBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
    });

    socket.on('driver_location_updated', ({ bookingId, lat, lng }) => {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, driver_lat: lat, driver_lng: lng } : b));
    });

    socket.on('user_updated', (updatedUser: UserProfile) => {
      if (user && user.name === updatedUser.name) {
        setUser(updatedUser);
      }
    });

    return () => {
      socket.off('new_booking');
      socket.off('booking_updated');
      socket.off('driver_location_updated');
      socket.off('user_updated');
    };
  }, [user]);

  const handleLogin = async (name: string, selectedRole: 'customer' | 'driver' | 'admin') => {
    if (selectedRole === 'admin') {
      setIsLoggedIn(true);
      setRole('admin');
      setView('admin');
      toast.success(lang === 'ar' ? 'مرحباً بك أيها المدير' : 'Welcome Admin');
      return;
    }

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role: selectedRole }),
      });
      if (!res.ok) throw new Error('Login failed');
      const userData = await res.json();
      setUser(userData);
      setRole(selectedRole);
      setIsLoggedIn(true);
      toast.success(lang === 'ar' ? `مرحباً بك ${name}` : `Welcome ${name}`);
    } catch (err) {
      toast.error(lang === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed');
    }
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} lang={lang} setLang={setLang} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Toaster position={lang === 'ar' ? 'top-right' : 'top-left'} richColors theme="dark" />
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">{lang === 'ar' ? 'ملك النقل' : 'King of Trucks'}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
              <Globe className="w-5 h-5" />
            </button>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-white">{user?.name || 'Admin'}</span>
              <span className="text-xs text-zinc-500">{role === 'customer' ? (lang === 'ar' ? 'عميل' : 'Customer') : role === 'driver' ? (lang === 'ar' ? 'سائق' : 'Driver') : 'Admin'}</span>
            </div>
            <button onClick={() => setIsLoggedIn(false)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <nav className="w-full md:w-64 border-l border-zinc-800 p-4 space-y-2">
          <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<History className="w-5 h-5" />} label={lang === 'ar' ? 'الرئيسية' : 'Dashboard'} />
          {role !== 'admin' && (
            <>
              <NavButton active={view === 'wallet'} onClick={() => setView('wallet')} icon={<Wallet className="w-5 h-5" />} label={lang === 'ar' ? 'المحفظة' : 'Wallet'} />
              <NavButton active={view === 'loyalty'} onClick={() => setView('loyalty')} icon={<Award className="w-5 h-5" />} label={lang === 'ar' ? 'الولاء' : 'Loyalty'} />
            </>
          )}
          {role === 'driver' && (
            <NavButton active={view === 'docs'} onClick={() => setView('docs')} icon={<FileText className="w-5 h-5" />} label={lang === 'ar' ? 'الوثائق' : 'Documents'} />
          )}
          {role === 'admin' && (
            <NavButton active={view === 'admin'} onClick={() => setView('admin')} icon={<PieChart className="w-5 h-5" />} label={lang === 'ar' ? 'الإدارة' : 'Admin'} />
          )}
        </nav>

        {/* Content */}
        <main className="flex-1 p-6">
          {view === 'dashboard' && (
            role === 'customer' ? <CustomerDashboard user={user!} bookings={bookings} lang={lang} /> : 
            role === 'driver' ? <DriverDashboard user={user!} bookings={bookings} lang={lang} /> :
            <AdminDashboard bookings={bookings} lang={lang} />
          )}
          {view === 'wallet' && <WalletView user={user!} lang={lang} />}
          {view === 'loyalty' && <LoyaltyView user={user!} lang={lang} />}
          {view === 'docs' && <DocumentsView user={user!} lang={lang} />}
          {view === 'admin' && <AdminDashboard bookings={bookings} lang={lang} />}
        </main>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, lang, setLang }: any) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'customer' | 'driver' | 'admin'>('customer');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="text-zinc-500 hover:text-white flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {lang === 'ar' ? 'English' : 'عربي'}
          </button>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{lang === 'ar' ? 'مرحباً بك في ملك النقل' : 'Welcome to King of Trucks'}</h1>
        <p className="text-zinc-400 mb-8">{lang === 'ar' ? 'أدخل بياناتك للمتابعة' : 'Enter your details to continue'}</p>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">{lang === 'ar' ? 'الاسم أو رقم الجوال' : 'Name or Mobile'}</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-orange-500/50" placeholder="05xxxxxxxx" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <RoleSelect active={role === 'customer'} onClick={() => setRole('customer')} label={lang === 'ar' ? 'عميل' : 'Customer'} />
              <RoleSelect active={role === 'driver'} onClick={() => setRole('driver')} label={lang === 'ar' ? 'سائق' : 'Driver'} />
              <RoleSelect active={role === 'admin'} onClick={() => setRole('admin')} label={lang === 'ar' ? 'مدير' : 'Admin'} />
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all">{lang === 'ar' ? 'إرسال الرمز' : 'Send Code'}</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">{lang === 'ar' ? 'رمز التحقق (OTP)' : 'Verification Code'}</label>
              <input value={otp} onChange={e => setOtp(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[1em] outline-none focus:ring-2 focus:ring-orange-500/50" placeholder="0000" maxLength={4} />
            </div>
            <button onClick={() => onLogin(name, role)} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all">{lang === 'ar' ? 'تأكيد' : 'Confirm'}</button>
            <button onClick={() => setStep(1)} className="w-full text-zinc-500 text-sm">{lang === 'ar' ? 'رجوع' : 'Back'}</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function RoleSelect({ active, onClick, label }: any) {
  return (
    <button onClick={onClick} className={cn("py-2 rounded-xl border text-sm transition-all", active ? "bg-orange-500/10 border-orange-500 text-orange-500" : "bg-zinc-800 border-zinc-700 text-zinc-500")}>{label}</button>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all", active ? "bg-orange-500 text-white shadow-lg shadow-orange-900/20" : "text-zinc-400 hover:bg-zinc-900 hover:text-white")}>
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function CustomerDashboard({ user, bookings, lang }: { user: UserProfile, bookings: Booking[], lang: 'ar' | 'en' }) {
  const [showForm, setShowForm] = useState(false);
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropoff, setDropoff] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
  const [vehicle, setVehicle] = useState<VehicleType>('dyna');
  const [cargo, setCargo] = useState(CARGO_TYPES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myBookings = bookings.filter(b => b.customer_name === user.name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupCoords || !dropoffCoords) {
      toast.error(lang === 'ar' ? 'يرجى تحديد المواقع على الخريطة' : 'Please select locations on map');
      return;
    }
    setIsSubmitting(true);
    
    const price = VEHICLE_DETAILS[vehicle].basePrice;
    if (user.wallet_balance < price) {
      toast.error(lang === 'ar' ? 'رصيد المحفظة غير كافٍ' : 'Insufficient wallet balance');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Math.random().toString(36).substr(2, 9),
          customer_name: user.name,
          pickup_location: pickup,
          pickup_lat: pickupCoords[0],
          pickup_lng: pickupCoords[1],
          dropoff_location: dropoff,
          dropoff_lat: dropoffCoords[0],
          dropoff_lng: dropoffCoords[1],
          vehicle_type: vehicle,
          cargo_type: cargo,
          price,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }
      
      toast.success(lang === 'ar' ? 'تم إرسال طلبك بنجاح' : 'Request sent successfully');
      setShowForm(false);
    } catch (err: any) {
      toast.error(lang === 'ar' ? `خطأ: ${err.message}` : `Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<Wallet className="text-orange-500" />} label={lang === 'ar' ? 'الرصيد' : 'Balance'} value={`${user.wallet_balance} SAR`} />
        <StatCard icon={<Award className="text-orange-500" />} label={lang === 'ar' ? 'النقاط' : 'Points'} value={user.loyalty_points} />
        <StatCard icon={<History className="text-orange-500" />} label={lang === 'ar' ? 'الرحلات' : 'Trips'} value={myBookings.length} />
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{lang === 'ar' ? 'رحلاتي' : 'My Trips'}</h2>
        <button onClick={() => setShowForm(true)} className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-900/20">
          <Plus className="w-5 h-5" />
          {lang === 'ar' ? 'طلب جديد' : 'New Request'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-white">{lang === 'ar' ? 'طلب نقل جديد' : 'New Transport Request'}</h3>
                <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <input required value={pickup} onChange={e => setPickup(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none" placeholder={lang === 'ar' ? 'موقع الاستلام' : 'Pickup Location'} />
                    <MapPicker type="pickup" label={lang === 'ar' ? 'الاستلام' : 'Pickup'} onSelect={(lat, lng) => setPickupCoords([lat, lng])} />
                  </div>
                  <div className="space-y-4">
                    <input required value={dropoff} onChange={e => setDropoff(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none" placeholder={lang === 'ar' ? 'موقع التسليم' : 'Dropoff Location'} />
                    <MapPicker type="dropoff" label={lang === 'ar' ? 'التسليم' : 'Dropoff'} onSelect={(lat, lng) => setDropoffCoords([lat, lng])} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-400">{lang === 'ar' ? 'نوع الشاحنة' : 'Vehicle Type'}</label>
                    <select value={vehicle} onChange={e => setVehicle(e.target.value as VehicleType)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none">
                      {Object.entries(VEHICLE_DETAILS).map(([key, d]) => <option key={key} value={key}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-400">{lang === 'ar' ? 'نوع الحمولة' : 'Cargo Type'}</label>
                    <select value={cargo} onChange={e => setCargo(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none">
                      {CARGO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 flex justify-between items-center">
                  <div>
                    <div className="text-sm text-zinc-500">{lang === 'ar' ? 'السعر' : 'Price'}</div>
                    <div className="text-3xl font-black text-white">{VEHICLE_DETAILS[vehicle].basePrice} SAR</div>
                  </div>
                  <div className="text-orange-500 text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    {lang === 'ar' ? 'تأمين شامل' : 'Full Insurance'}
                  </div>
                </div>

                <button disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-900/20">{isSubmitting ? '...' : (lang === 'ar' ? 'تأكيد الطلب' : 'Confirm Request')}</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {myBookings.map(b => <BookingCard key={b.id} booking={b} role="customer" lang={lang} />)}
      </div>
    </div>
  );
}

function DriverDashboard({ user, bookings, lang }: any) {
  const available = bookings.filter((b: any) => b.status === 'pending');
  const active = bookings.filter((b: any) => b.driver_id === user.name && b.status === 'accepted');

  const handleAccept = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: user.name }),
      });
      if (!res.ok) throw new Error('Failed to accept');
      toast.success(lang === 'ar' ? 'تم قبول المهمة' : 'Job accepted');
    } catch (err) {
      toast.error(lang === 'ar' ? 'عذراً، الطلب لم يعد متاحاً' : 'Sorry, request no longer available');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}/complete`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to complete');
      toast.success(lang === 'ar' ? 'تم إتمام المهمة بنجاح' : 'Job completed successfully');
    } catch (err) {
      toast.error(lang === 'ar' ? 'فشل في إتمام المهمة' : 'Failed to complete job');
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<TrendingUp className="text-orange-500" />} label={lang === 'ar' ? 'أرباح اليوم' : 'Daily Earnings'} value="450 SAR" />
        <StatCard icon={<Clock className="text-orange-500" />} label={lang === 'ar' ? 'ساعات العمل' : 'Work Hours'} value="6.5h" />
        <StatCard icon={<CheckCircle2 className="text-orange-500" />} label={lang === 'ar' ? 'المهام المكتملة' : 'Completed'} value="12" />
      </div>

      {active.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            {lang === 'ar' ? 'المهام النشطة' : 'Active Jobs'}
          </h2>
          {active.map((b: any) => <BookingCard key={b.id} booking={b} role="driver" onComplete={() => handleComplete(b.id)} lang={lang} />)}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">{lang === 'ar' ? 'الطلبات المتاحة' : 'Available Requests'}</h2>
        {available.map((b: any) => <BookingCard key={b.id} booking={b} role="driver" onAccept={() => handleAccept(b.id)} lang={lang} />)}
      </section>
    </div>
  );
}

function AdminDashboard({ bookings, lang }: any) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        toast.error(lang === 'ar' ? 'فشل في تحميل الإحصائيات' : 'Failed to load statistics');
      }
    };
    fetchStats();
  }, [lang]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<PieChart className="text-orange-500" />} label="Total Revenue" value={`${stats?.totalRevenue || 0} SAR`} />
        <StatCard icon={<Users className="text-orange-500" />} label="Active Drivers" value={stats?.activeDrivers || 0} />
        <StatCard icon={<History className="text-orange-500" />} label="Total Trips" value={stats?.totalBookings || 0} />
        <StatCard icon={<ShieldCheck className="text-orange-500" />} label="Verified" value="98%" />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Live Fleet Map</h3>
        <div className="h-96 rounded-2xl overflow-hidden border border-zinc-800">
          <MapContainer center={RIYADH_COORDS} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {bookings.map((b: any) => (
              b.driver_lat && <Marker key={b.id} position={[b.driver_lat, b.driver_lng]} icon={DRIVER_ICON} />
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

function WalletView({ user, lang }: any) {
  const [amount, setAmount] = useState('');
  
  const handleAdd = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error(lang === 'ar' ? 'أدخل مبلغاً صحيحاً' : 'Enter a valid amount');
      return;
    }
    try {
      const res = await fetch(`/api/users/${user.name}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      if (!res.ok) throw new Error('Top up failed');
      toast.success(lang === 'ar' ? 'تم شحن المحفظة بنجاح' : 'Wallet topped up successfully');
      setAmount('');
    } catch (err) {
      toast.error(lang === 'ar' ? 'فشل في شحن المحفظة' : 'Failed to top up wallet');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-gradient-to-br from-orange-600 to-orange-800 p-8 rounded-3xl shadow-2xl">
        <div className="text-orange-200 text-sm mb-2">{lang === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}</div>
        <div className="text-5xl font-black text-white">{user.wallet_balance} SAR</div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <h3 className="text-xl font-bold text-white">{lang === 'ar' ? 'شحن المحفظة' : 'Top Up Wallet'}</h3>
        <div className="flex gap-4">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none" placeholder="0.00" />
          <button onClick={handleAdd} className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-3 rounded-xl font-bold">شحن</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <PaymentOption icon={<CreditCard />} label="Mada" />
          <PaymentOption icon={<CreditCard />} label="Visa" />
          <PaymentOption icon={<Phone />} label="stc pay" />
        </div>
      </div>
    </div>
  );
}

function LoyaltyView({ user, lang }: any) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center">
        <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Award className="w-10 h-10" />
        </div>
        <h3 className="text-3xl font-black text-white mb-2">{user.loyalty_points}</h3>
        <p className="text-zinc-500">{lang === 'ar' ? 'نقطة ولاء' : 'Loyalty Points'}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <RewardCard title="خصم 10% على الرحلة القادمة" points={500} lang={lang} />
        <RewardCard title="غسيل شاحنة مجاني" points={1200} lang={lang} />
        <RewardCard title="فحص فني مجاني" points={2500} lang={lang} />
      </div>
    </div>
  );
}

function DocumentsView({ user, lang }: any) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h3 className="text-2xl font-bold text-white">{lang === 'ar' ? 'إدارة الوثائق' : 'Document Management'}</h3>
      <DocCard title={lang === 'ar' ? 'رخصة القيادة' : 'Driver License'} status={user.documents_verified ? 'verified' : 'pending'} lang={lang} />
      <DocCard title={lang === 'ar' ? 'استمارة الشاحنة' : 'Vehicle Registration'} status={user.documents_verified ? 'verified' : 'pending'} lang={lang} />
      <DocCard title={lang === 'ar' ? 'وثيقة التأمين' : 'Insurance Policy'} status={user.documents_verified ? 'verified' : 'pending'} lang={lang} />
    </div>
  );
}

function StatCard({ icon, label, value }: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-zinc-800 rounded-lg">{icon}</div>
        <span className="text-sm text-zinc-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function PaymentOption({ icon, label }: any) {
  return (
    <button className="flex flex-col items-center gap-2 p-4 bg-zinc-800 border border-zinc-700 rounded-2xl hover:border-orange-500 transition-all">
      <div className="text-zinc-400">{icon}</div>
      <span className="text-xs text-zinc-500">{label}</span>
    </button>
  );
}

function RewardCard({ title, points, lang }: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex justify-between items-center">
      <div>
        <div className="font-bold text-white mb-1">{title}</div>
        <div className="text-xs text-orange-500 font-bold">{points} {lang === 'ar' ? 'نقطة' : 'Points'}</div>
      </div>
      <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm font-bold">{lang === 'ar' ? 'استبدال' : 'Redeem'}</button>
    </div>
  );
}

function DocCard({ title, status, lang }: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-zinc-800 rounded-2xl text-zinc-400"><Camera className="w-6 h-6" /></div>
        <div>
          <div className="font-bold text-white">{title}</div>
          <div className={cn("text-xs font-bold", status === 'verified' ? "text-emerald-500" : "text-amber-500")}>
            {status === 'verified' ? (lang === 'ar' ? 'تم التحقق' : 'Verified') : (lang === 'ar' ? 'بانتظار المراجعة' : 'Pending Review')}
          </div>
        </div>
      </div>
      <button className="text-orange-500 font-bold text-sm">{lang === 'ar' ? 'تحديث' : 'Update'}</button>
    </div>
  );
}

function MapPicker({ onSelect, label, type }: any) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  function LocationMarker() {
    useMapEvents({ click(e) { setPosition([e.latlng.lat, e.latlng.lng]); onSelect(e.latlng.lat, e.latlng.lng); } });
    return position === null ? null : <Marker position={position} icon={type === 'pickup' ? PICKUP_ICON : DROPOFF_ICON} />;
  }
  return (
    <div className="h-40 rounded-xl overflow-hidden border border-zinc-700">
      <MapContainer center={RIYADH_COORDS} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationMarker />
      </MapContainer>
    </div>
  );
}

function LiveMap({ booking }: any) {
  const center: [number, number] = [(booking.pickup_lat + booking.dropoff_lat) / 2, (booking.pickup_lng + booking.dropoff_lng) / 2];
  return (
    <div className="h-64 rounded-2xl overflow-hidden border border-zinc-800 mt-4">
      <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[booking.pickup_lat, booking.pickup_lng]} icon={PICKUP_ICON} />
        <Marker position={[booking.dropoff_lat, booking.dropoff_lng]} icon={DROPOFF_ICON} />
        {booking.driver_lat && <Marker position={[booking.driver_lat, booking.driver_lng]} icon={DRIVER_ICON} />}
        <Polyline positions={[[booking.pickup_lat, booking.pickup_lng], [booking.dropoff_lat, booking.dropoff_lng]]} color="#f97316" dashArray="10, 10" weight={3} />
      </MapContainer>
    </div>
  );
}

function BookingCard({ booking, role, onAccept, onComplete, lang }: any) {
  const [showMap, setShowMap] = useState(false);
  const details = VEHICLE_DETAILS[booking.vehicle_type as VehicleType];
  
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-zinc-700 transition-all">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-orange-500">
                {booking.vehicle_type === 'trella' && <Truck className="w-6 h-6" />}
                {booking.vehicle_type === 'dyna' && <Container className="w-6 h-6" />}
                {booking.vehicle_type === 'sataha' && <Car className="w-6 h-6" />}
                {booking.vehicle_type === 'qallaba' && <HardHat className="w-6 h-6" />}
              </div>
              <div>
                <div className="font-bold text-white">{details.name}</div>
                <div className="text-xs text-zinc-500">#{booking.id} • {booking.cargo_type}</div>
              </div>
            </div>
            <div className={cn("px-3 py-1 rounded-full text-xs font-bold", booking.status === 'pending' ? "bg-amber-500/10 text-amber-500" : booking.status === 'accepted' ? "bg-orange-500/10 text-orange-500" : "bg-zinc-800 text-zinc-500")}>
              {booking.status === 'pending' ? (lang === 'ar' ? 'بانتظار سائق' : 'Pending') : booking.status === 'accepted' ? (lang === 'ar' ? 'جاري التنفيذ' : 'In Progress') : (lang === 'ar' ? 'مكتمل' : 'Completed')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50">
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{lang === 'ar' ? 'من' : 'From'}</div>
              <div className="text-sm text-zinc-300 truncate">{booking.pickup_location}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{lang === 'ar' ? 'إلى' : 'To'}</div>
              <div className="text-sm text-zinc-300 truncate">{booking.dropoff_location}</div>
            </div>
          </div>

          {showMap && <LiveMap booking={booking} />}
        </div>

        <div className="md:w-48 flex flex-col justify-between items-end gap-4 border-t md:border-t-0 md:border-r border-zinc-800 pt-4 md:pt-0 md:pr-6">
          <div className="text-right w-full">
            <div className="text-xs text-zinc-500 mb-1">{lang === 'ar' ? 'السعر' : 'Price'}</div>
            <div className="text-2xl font-black text-white">{booking.price} SAR</div>
          </div>
          
          <div className="w-full space-y-2">
            <button onClick={() => setShowMap(!showMap)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-2">
              <MapIcon className="w-4 h-4" />
              {showMap ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'تتبع' : 'Track')}
            </button>

            {role === 'driver' && booking.status === 'pending' && (
              <button onClick={onAccept} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-900/20">{lang === 'ar' ? 'قبول' : 'Accept'}</button>
            )}

            {booking.status === 'accepted' && role === 'driver' && (
              <button onClick={onComplete} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl">{lang === 'ar' ? 'إتمام' : 'Complete'}</button>
            )}
            
            {booking.status === 'accepted' && role === 'customer' && (
              <button className="w-full bg-zinc-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" />
                {lang === 'ar' ? 'اتصال' : 'Call'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
