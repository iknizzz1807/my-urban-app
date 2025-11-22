import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import './App.css';

interface ReportData {
  image: string;
  coords: string;
  timestamp: string;
}

function App() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string>('');

  // 1. Hàm chụp ảnh thật
  const takePhoto = async () => {
    setError('');
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri, // Lấy đường dẫn file thực
        source: CameraSource.Camera // Mở Camera ngay lập tức
      });

      if (photo.webPath) {
        // Lưu ảnh tạm vào state để hiển thị
        // Trong thực tế, bạn sẽ upload file từ photo.path
        startProcess(photo.webPath);
      }
    } catch (e: any) {
      console.error(e);
      if (e.message !== 'User cancelled photos app') {
        setError('Không thể mở Camera: ' + e.message);
      }
    }
  };

  // 2. Quy trình xử lý (Giả lập AI + Lấy GPS thật)
  const startProcess = async (imageUri: string) => {
    setLoading(true);
    
    try {
      // Lấy tọa độ GPS thật
      const position = await Geolocation.getCurrentPosition();
      const coords = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;

      // Giả lập AI đợi 1.5s
      setTimeout(() => {
        setReport({
          image: imageUri,
          coords: coords,
          timestamp: new Date().toLocaleString()
        });
        setLoading(false);
      }, 1500);

    } catch (e: any) {
      setError('Không lấy được vị trí: ' + e.message);
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Urban Feedback</h1>
      </header>

      <main className="content">
        {error && <div className="error-box">{error}</div>}

        {!report ? (
          <div className="empty-state">
            <p>Chưa có báo cáo nào.</p>
            <p className="sub-text">Hãy chụp ảnh sự cố để gửi báo cáo.</p>
          </div>
        ) : (
          <div className="report-card">
            <img src={report.image} alt="Report" className="captured-image" />
            <div className="report-info">
              <div className="badge">AI: POTHOLE DETECTED</div>
              <p><strong>📍 Vị trí:</strong> {report.coords}</p>
              <p><strong>🕒 Thời gian:</strong> {report.timestamp}</p>
            </div>
            <button className="btn-reset" onClick={() => setReport(null)}>
              Gửi báo cáo khác
            </button>
          </div>
        )}
      </main>

      {/* Footer Button Action */}
      <div className="fab-container">
        <button 
          className="fab-btn" 
          onClick={takePhoto} 
          disabled={loading}
        >
          {loading ? '⏳' : '📷'}
        </button>
      </div>
      
      {loading && (
        <div className="loader-overlay">
          <span>Đang xử lý...</span>
        </div>
      )}
    </div>
  );
}

export default App;
