import React, { useState, useRef } from 'react';
import { Camera, MapPin, Home, User, Send, Loader2, CheckCircle2, AlertTriangle, Map, Clock, ChevronRight, X } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
/**
 * --- PHẦN 1: MOCK DATA & UTILITIES ---
 * Giả lập Backend, AI Model và Geolocation
 */

// Danh sách các loại sự cố mà AI có thể nhận diện
const MOCK_CATEGORIES = [
  { id: 'pothole', name: 'Hư hỏng đường bộ (Ổ gà)', color: 'text-red-600 bg-red-50', icon: AlertTriangle },
  { id: 'trash', name: 'Rác thải bừa bãi', color: 'text-orange-600 bg-orange-50', icon: Map },
  { id: 'light', name: 'Sự cố chiếu sáng', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
  { id: 'tree', name: 'Cây xanh ngã đổ', color: 'text-green-600 bg-green-50', icon: MapPin },
];

// Hàm giả lập AI phân tích hình ảnh (Delay 2.5s)
const simulateAIAnalysis = () => {
  return new Promise<{ category: typeof MOCK_CATEGORIES[0], confidence: number }>((resolve) => {
    setTimeout(() => {
      // Random một loại sự cố
      const randomCat = MOCK_CATEGORIES[Math.floor(Math.random() * MOCK_CATEGORIES.length)];
      resolve({ category: randomCat, confidence: 0.85 + Math.random() * 0.1 });
    }, 2500);
  });
};

const getAddressFromCoordinates = async (lat: number, lng: number) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'MyCapacitorApp/1.0' } } // Cần header này để không bị chặn
    );
    const data = await response.json();
    
    // Xử lý hiển thị địa chỉ ngắn gọn
    if (data.display_name) {
      // Lấy tên đường và quận/huyện để hiển thị cho gọn
      const parts = data.display_name.split(',');
      return parts.slice(0, 3).join(', '); 
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch (error) {
    console.error("Lỗi lấy địa chỉ:", error);
    return "Không thể xác định tên đường";
  }
};

// Interface cho đối tượng Báo cáo
interface Report {
  id: string;
  imageUrl: string;
  category: typeof MOCK_CATEGORIES[0];
  address: string;
  description: string;
  status: 'pending' | 'processing' | 'completed';
  timestamp: number;
}

/**
 * --- PHẦN 2: UI COMPONENTS ---
 * Các thành phần giao diện nhỏ
 */

const Header = ({ title, subtitle }: { title: string, subtitle?: string }) => (
  <div className="bg-white px-4 pt-12 pb-4 shadow-sm sticky top-0 z-20 border-b border-slate-100">
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold shadow-inner">
        CV
      </div>
    </div>
  </div>
);

const ReportCard = ({ report }: { report: Report }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-4 active:scale-[0.98] transition-transform">
    <div className="flex gap-4">
      <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200 relative">
        <img src={report.imageUrl} alt="Report" className="w-full h-full object-cover" />
        <div className={`absolute top-1 left-1 p-1 rounded-md bg-white/90 backdrop-blur-sm ${report.category.color}`}>
           <report.category.icon size={12} />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide mb-1 ${report.category.color}`}>
            {report.category.name}
          </div>
          <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-tight">{report.address}</p>
        </div>
        
        <div className="mt-2 flex justify-between items-end border-t border-slate-50 pt-2">
          <span className="text-xs text-slate-400">{new Date(report.timestamp).toLocaleDateString('vi-VN')}</span>
          <span className={`text-xs font-bold px-2 py-1 rounded ${
            report.status === 'completed' ? 'text-emerald-600 bg-emerald-50' : 
            report.status === 'processing' ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50'
          }`}>
            {report.status === 'completed' ? 'Đã xử lý' : report.status === 'processing' ? 'Đang xử lý' : 'Tiếp nhận'}
          </span>
        </div>
      </div>
    </div>
  </div>
);

/**
 * --- PHẦN 3: MAIN APPLICATION ---
 * Component chính App
 */

export default function App() {
  // State điều hướng và dữ liệu
  const [activeTab, setActiveTab] = useState<'home' | 'camera' | 'profile'>('home');
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=400',
      category: MOCK_CATEGORIES[0],
      address: '123 Nguyễn Huệ, Q.1',
      description: 'Ổ gà lớn gây nguy hiểm cho xe máy.',
      status: 'processing',
      timestamp: Date.now() - 86400000
    }
  ]);

  // State cho luồng Camera & AI
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>(''); // Text hiển thị trạng thái AI
  const [detectedData, setDetectedData] = useState<{ category: any, address: string } | null>(null);
  const [description, setDescription] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Xử lý khi người dùng chọn ảnh (Giả lập chụp ảnh)
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        startAnalysisFlow(); // Bắt đầu quy trình AI ngay khi có ảnh
      };
      reader.readAsDataURL(file);
    }
  };

  // Quy trình giả lập AI và GPS
  const startAnalysisFlow = async () => {
    setIsAnalyzing(true);
    setDetectedData(null);

    try {
      // Bước 1: Upload ảnh (giả lập)
      setAnalysisStep('Đang tải ảnh lên hệ thống...');
      await new Promise(r => setTimeout(r, 800));

      // Bước 2: AI quét ảnh
      setAnalysisStep('AI đang phân tích sự cố...');
      const aiResult = await simulateAIAnalysis();
      
      // Bước 3: Lấy toạ độ GPS THẬT
      setAnalysisStep('Đang định vị GPS...');
      
      // Kiểm tra quyền truy cập
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location === 'denied') {
         alert("Vui lòng cấp quyền vị trí để sử dụng tính năng này.");
         setIsAnalyzing(false);
         return;
      }

      // Lấy toạ độ hiện tại
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true, // Lấy chính xác cao (dùng GPS)
        timeout: 10000,           // Timeout sau 10s
      });

      const { latitude, longitude } = position.coords;
      
      // Bước 4: Đổi toạ độ sang tên đường (Reverse Geocoding)
      setAnalysisStep('Đang xác thực địa chỉ...');
      const realAddress = await getAddressFromCoordinates(latitude, longitude);

      // Hoàn tất
      setDetectedData({
        category: aiResult.category,
        address: realAddress
      });
      
    } catch (error) {
      console.error("Lỗi quy trình:", error);
      alert("Không thể lấy vị trí. Vui lòng kiểm tra GPS.");
      // Fallback nếu lỗi: dùng toạ độ giả hoặc thông báo lỗi
      setDetectedData({
         category: MOCK_CATEGORIES[0],
         address: "Không xác định được vị trí"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };  // Xử lý gửi báo cáo cuối cùng

  const handleSubmitReport = () => {
    if (!detectedData || !imagePreview) return;

    const newReport: Report = {
      id: Date.now().toString(),
      imageUrl: imagePreview,
      category: detectedData.category,
      address: detectedData.address,
      description: description,
      status: 'pending',
      timestamp: Date.now()
    };

    setReports([newReport, ...reports]); // Thêm vào đầu danh sách
    setShowSuccess(true);
    
    // Reset về trang chủ sau 2 giây thông báo thành công
    setTimeout(() => {
      setShowSuccess(false);
      setImagePreview(null);
      setDetectedData(null);
      setDescription('');
      setActiveTab('home');
    }, 2000);
  };

  const handleRetake = () => {
    setImagePreview(null);
    setDetectedData(null);
    fileInputRef.current?.click();
  };

  // --- RENDER ---

  // MÀN HÌNH 1: CAMERA / REPORT FLOW
  if (activeTab === 'camera') {
    return (
      <div className="h-screen bg-slate-900 flex flex-col relative overflow-hidden">
        {/* Input file ẩn để kích hoạt camera native hoặc thư viện ảnh */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />

        {!imagePreview ? (
          // TRẠNG THÁI 1: CHỜ CHỤP ẢNH
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
            {/* Background mờ */}
            <div className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm" style={{backgroundImage: 'url(https://images.unsplash.com/photo-1449824913929-2b5a63beba1d?auto=format&fit=crop&q=80)'}}></div>
            
            <div className="z-10 text-center w-full max-w-xs">
              <div className="w-full aspect-square border-2 border-dashed border-emerald-500/50 rounded-3xl mb-8 mx-auto flex items-center justify-center bg-slate-800/50 backdrop-blur-sm">
                 <Camera className="text-emerald-500 opacity-50" size={48} />
              </div>
              
              <h2 className="text-white text-2xl font-bold mb-2">Chụp ảnh sự cố</h2>
              <p className="text-slate-300 text-sm mb-10">AI sẽ tự động nhận diện loại vấn đề</p>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95 transition-all mx-auto"
              >
                <div className="w-16 h-16 bg-emerald-500 rounded-full border-2 border-white"></div>
              </button>
              
              <button 
                onClick={() => setActiveTab('home')}
                className="mt-8 text-slate-400 text-sm font-medium py-2 px-4 rounded-full bg-slate-800/50"
              >
                Huỷ bỏ
              </button>
            </div>
          </div>
        ) : (
          // TRẠNG THÁI 2: ĐÃ CÓ ẢNH (Preview -> AI -> Form)
          <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-y-auto">
            <div className="relative w-full h-64 bg-black flex-shrink-0">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              
              {/* Overlay khi AI đang chạy */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 animate-pulse"></div>
                    <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4 relative z-10" />
                  </div>
                  <p className="text-emerald-50 font-medium animate-pulse tracking-wide">{analysisStep}</p>
                </div>
              )}
              
              {/* Nút đóng */}
              {!isAnalyzing && (
                 <button 
                   onClick={handleRetake}
                   className="absolute top-4 left-4 bg-black/40 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/60 transition-colors"
                 >
                   <X size={20}/>
                 </button>
              )}
            </div>

            {/* Form xác nhận thông tin (Chỉ hiện khi AI chạy xong) */}
            {detectedData && !isAnalyzing && !showSuccess && (
              <div className="flex-1 bg-white -mt-6 rounded-t-3xl p-6 shadow-2xl flex flex-col animate-slide-up relative z-20">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-800">Chi tiết phản ánh</h3>
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">AI Detected</span>
                </div>
                
                <div className="space-y-5 mb-6">
                  {/* Kết quả AI */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-wider">Vấn đề phát hiện</label>
                    <div className="flex items-center gap-3 text-slate-800 font-semibold">
                      <div className={`p-2 rounded-full ${detectedData.category.color.replace('text-', 'bg-').replace('bg-', 'bg-opacity-20 ')}`}>
                         <detectedData.category.icon className="text-emerald-600" size={20} />
                      </div>
                      {detectedData.category.name}
                    </div>
                  </div>

                  {/* Kết quả GPS */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-wider">Vị trí sự cố</label>
                    <div className="flex items-center gap-3 text-slate-800 font-medium">
                      <div className="p-2 rounded-full bg-blue-50">
                        <MapPin className="text-blue-600" size={20} />
                      </div>
                      <span className="text-sm leading-tight">{detectedData.address}</span>
                    </div>
                  </div>

                  {/* Input mô tả */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-wider">Mô tả thêm (Tuỳ chọn)</label>
                    <textarea 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      rows={3}
                      placeholder="Ví dụ: Ổ gà rất sâu, nguy hiểm vào ban đêm..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="mt-auto pt-4">
                  <button 
                    onClick={handleSubmitReport}
                    className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    <Send size={20} />
                    Gửi phản ánh ngay
                  </button>
                </div>
              </div>
            )}

            {/* Màn hình thành công */}
            {showSuccess && (
              <div className="absolute inset-0 z-50 bg-emerald-600 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl scale-110">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Đã gửi thành công!</h2>
                <p className="text-emerald-100 text-lg">Cảm ơn bạn đã chung tay vì một đô thị văn minh.</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // MÀN HÌNH 2: TRANG CHỦ & CÁ NHÂN (Layout chung)
  return (
    <div className="bg-slate-50 min-h-screen flex flex-col font-sans text-slate-900">
      
      {/* Nội dung chính cuộn được */}
      <div className="flex-1 pb-24 overflow-y-auto scroll-smooth">
        {activeTab === 'home' && (
          <>
            <Header title="Tổng quan" subtitle="Xin chào, Cư dân tích cực 👋" />
            
            {/* Thống kê nhanh */}
            <div className="px-4 mb-6 mt-4">
               <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
                 <div className="flex items-start justify-between relative z-10">
                   <div>
                     <p className="text-emerald-100 text-sm font-medium mb-1">Đóng góp của bạn</p>
                     <h3 className="text-4xl font-bold">{reports.length}</h3>
                     <p className="text-xs text-emerald-100 mt-2 flex items-center gap-1">
                       <CheckCircle2 size={12}/> Báo cáo đã gửi
                     </p>
                   </div>
                   <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                     <MapPin className="text-white" size={24} />
                   </div>
                 </div>
               </div>
            </div>

            {/* Call To Action */}
            <div className="px-4 mb-8">
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-2.5 rounded-full">
                    <AlertTriangle className="text-orange-600" size={20}/>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Phát hiện sự cố?</h4>
                    <p className="text-xs text-slate-500">Chụp ảnh ngay để báo cáo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('camera')}
                  className="text-orange-700 text-xs font-bold bg-white px-4 py-2.5 rounded-lg shadow-sm border border-orange-100 active:bg-orange-50 transition-colors"
                >
                  Chụp ngay
                </button>
              </div>
            </div>

            {/* Danh sách Feed */}
            <div className="px-4">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-lg text-slate-800">Gần đây</h3>
                 <button className="text-emerald-600 text-xs font-semibold">Xem tất cả</button>
              </div>
              
              {reports.length === 0 ? (
                <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                  Chưa có báo cáo nào
                </div>
              ) : (
                reports.map(report => <ReportCard key={report.id} report={report} />)
              )}
            </div>
          </>
        )}

        {activeTab === 'profile' && (
          <div className="p-4 pt-12">
             <h2 className="text-2xl font-bold mb-6 pl-2">Tài khoản</h2>
             
             <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6 flex items-center gap-5">
               <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center border-4 border-slate-50 shadow-inner">
                 <User className="text-slate-400" size={36}/>
               </div>
               <div>
                 <h3 className="font-bold text-xl text-slate-800">Nguyễn Văn A</h3>
                 <p className="text-slate-500 text-sm mb-2">Cư dân Quận 1</p>
                 <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">Thành viên tích cực</span>
               </div>
             </div>
             
             <div className="space-y-3">
               {['Lịch sử báo cáo', 'Thông báo', 'Cài đặt ứng dụng', 'Điều khoản sử dụng'].map((item, idx) => (
                 <button key={item} className="w-full bg-white p-4 rounded-xl flex justify-between items-center border border-slate-100 shadow-sm active:scale-[0.99] transition-transform text-left">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${idx === 3 ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                        {idx === 0 ? <Clock size={16}/> : idx === 1 ? <AlertTriangle size={16}/> : idx === 2 ? <User size={16}/> : <Map size={16}/>}
                      </div>
                      <span className="font-medium text-slate-700 text-sm">{item}</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300"/>
                 </button>
               ))}
               
               <button className="w-full mt-6 p-4 rounded-xl flex justify-center items-center text-red-600 font-medium text-sm bg-red-50 border border-red-100">
                 Đăng xuất
               </button>
             </div>
          </div>
        )}
      </div>

      {/* THANH ĐIỀU HƯỚNG DƯỚI (BOTTOM NAVIGATION) */}
      <div className="fixed bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe pt-2 px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-30 h-[84px]">
        <div className="flex justify-between items-center max-w-md mx-auto relative">
          
          {/* Tab Home */}
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors ${activeTab === 'home' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Trang chủ</span>
          </button>

          {/* Nút Camera Lớn ở giữa */}
          <div className="relative -top-6">
            <button 
              onClick={() => setActiveTab('camera')}
              className="w-16 h-16 bg-emerald-600 text-white rounded-full shadow-[0_8px_20px_rgba(5,150,105,0.4)] active:scale-95 active:shadow-sm transition-all flex items-center justify-center border-4 border-slate-50"
            >
              <Camera size={28} />
            </button>
          </div>

          {/* Tab Profile */}
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors ${activeTab === 'profile' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Cá nhân</span>
          </button>
        </div>
      </div>

    </div>
  );
}

