
type Props = {
  status: string
  image: string // base64 string เช่น "data:image/png;base64,...."
}

const StudentSleep = ({ status, image }: Props) => {
  if (status !== "SLEEPING") return null  

  return (
    <div className="p-4 bg-red-50 rounded-lg shadow text-center">
      <h2 className="text-xl font-bold text-red-600 mb-2">ตรวจพบการหลับในห้อง</h2>
      <img
        src={image}
        alt="student sleeping"
        className="mx-auto rounded border border-red-200 max-w-xs"
      />
    </div>
  )
}

export default StudentSleep