import { motion } from 'framer-motion'

/** Fixed, slowly drifting blurred colour blobs behind the whole app. */
export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#f8f9fa]" style={{ zIndex: -1 }}>
      {/* Blob 1 */}
      <motion.div
        animate={{
          left: ['10%', '50%', '10%', '10%'],
          top: ['10%', '10%', '50%', '10%'],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[5%] left-[15%] w-[30vw] h-[30vw] bg-[#1B263B]/75 rounded-full blur-[100px] will-change-transform"
      />

      {/* Blob 2 */}
      <motion.div
        animate={{
          right: ['5%', '10%', '5%'],
          top: ['15%', '12%', '15%'],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        className="absolute w-[35vw] h-[35vw] bg-[#4A5568]/75 rounded-full blur-[90px] will-change-transform"
      />

      {/* Blob 3 (center depth) */}
      <motion.div
        animate={{
          left: ['30%', '10%', '30%'],
          top: ['40%', '45%', '40%'],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[30%] left-[25%] w-[45vw] h-[45vw] bg-[#8957E5]/75 rounded-full blur-[130px] will-change-transform"
      />

      {/* Blob 4 (bottom corner) */}
      <motion.div
        animate={{
          left: ['-5%', '5%', '-5%'],
          bottom: ['5%', '15%', '5%'],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-[5%] right-[5%] w-[30vw] h-[30vw] bg-[#C5A059]/75 rounded-full blur-[110px] will-change-transform"
      />

      {/* Blob 5 */}
      <motion.div
        animate={{
          right: ['5%', '15%', '5%'],
          bottom: ['10%', '5%', '10%'],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-[5%] left-[5%] w-[30vw] h-[30vw] bg-[#00B5AD]/75 rounded-full blur-[110px] will-change-transform"
      />
    </div>
  )
}
