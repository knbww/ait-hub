import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { useCourses } from '../hooks/useCourses'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'

export function CoursesCard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t } = useI18n()
  const { data: courses = [] } = useCourses(profile?.id)

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <h2 className="text-2xl font-light mb-6">{t('card.courses')}</h2>

        {courses.length === 0 ? (
          <div>
            <p className="text-sm text-gray-600 mb-3">{t('courses.notEnrolled')}</p>
            <button
              onClick={() => navigate('/academy')}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {t('courses.catalogLink')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course) => (
              <div
                key={course.courseId}
                className="backdrop-blur-[35px] bg-white/20 border border-white/50 rounded-2xl p-6 shadow-[0_4px_16px_0_rgba(31,38,135,0.15)]"
              >
                <h3 className="text-xl font-normal mb-6">{course.title}</h3>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      {t('courses.percentDone', { n: course.progress })}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#750014] h-1.5 rounded-full"
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                </div>

                {course.syllabusUrl && (
                  <a
                    href={course.syllabusUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center px-4 py-1.5 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 transition-all duration-300 text-sm mb-4"
                  >
                    {t('courses.openSyllabus')}
                  </a>
                )}

                <div className="space-y-1 text-sm text-gray-700">
                  {course.instructor && <p>{t('courses.instructor', { name: course.instructor })}</p>}
                  {course.duration && <p>{t('courses.duration', { value: course.duration })}</p>}
                  {course.level && <p>{t('courses.level', { value: course.level })}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
