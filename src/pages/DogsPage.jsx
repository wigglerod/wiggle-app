import Header from '../components/Header'
import BottomTabs from '../components/BottomTabs'

export default function DogsPage() {
  return (
    <div className="min-h-screen bg-[#FFF4F1] pb-20">
      <Header />

      <main className="px-4 py-4 max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <span className="text-6xl">🐾</span>
          <p className="text-lg font-semibold text-gray-600">Dogs coming soon</p>
          <p className="text-sm text-gray-400">Dog profiles will live here</p>
        </div>
      </main>

      <BottomTabs />
    </div>
  )
}
