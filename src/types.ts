export type VehicleType = 'trella' | 'dyna' | 'sataha' | 'qallaba';

export interface Booking {
  id: string;
  customer_name: string;
  pickup_location: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_location: string;
  dropoff_lat: number;
  dropoff_lng: number;
  vehicle_type: VehicleType;
  cargo_type?: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  driver_id?: string;
  driver_lat?: number;
  driver_lng?: number;
  price: number;
  points_earned: number;
  created_at: string;
}

export interface UserProfile {
  name: string;
  role: 'customer' | 'driver';
  wallet_balance: number;
  loyalty_points: number;
  is_online?: boolean;
  documents_verified?: boolean;
}

export const VEHICLE_DETAILS = {
  trella: {
    name: 'تريلا (شاحنة كبيرة)',
    description: 'للحمولات الكبيرة جداً والمصانع',
    icon: 'Truck',
    basePrice: 500,
  },
  dyna: {
    name: 'دينا (شاحنة متوسطة)',
    description: 'لنقل العفش والبضائع المتوسطة',
    icon: 'Container',
    basePrice: 200,
  },
  sataha: {
    name: 'سطحة (لنقل السيارات)',
    description: 'لسحب السيارات المعطلة أو المصدومة',
    icon: 'Car',
    basePrice: 150,
  },
  qallaba: {
    name: 'قلابة (نقل مواد بناء)',
    description: 'لنقل الرمل، البطحاء، والخرسانة',
    icon: 'HardHat',
    basePrice: 300,
  },
};

export const CARGO_TYPES = [
  'رمل', 'بطحاء', 'خرسانة', 'عفش منزل', 'بضائع تجارية', 'سيارة', 'أخرى'
];
