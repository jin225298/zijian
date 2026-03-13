'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loginMode, setLoginMode] = useState<'sms' | 'password'>('password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 验证手机号格式
  const validatePhone = useCallback((value: string): boolean => {
    if (!value) {
      setPhoneError('请输入手机号')
      return false
    }
    if (!/^1[3-9]\d{9}$/.test(value)) {
      setPhoneError('手机号格式错误（需为11位大陆手机号）')
      return false
    }
    setPhoneError('')
    return true
  }, [])

  // 验证验证码格式
  const validateCode = useCallback((value: string): boolean => {
    if (!value) {
      setCodeError('请输入验证码')
      return false
    }
    if (!/^\d{6}$/.test(value)) {
      setCodeError('验证码必须为6位数字')
      return false
    }
    setCodeError('')
    return true
  }, [])

  // 发送验证码
  const handleSendCode = async () => {
    if (!validatePhone(phone)) return

    setIsSendingCode(true)
    setMessage(null)

    try {
      const response = await fetch('/api/v1/auth/sms-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: '验证码已发送，请查收短信' })
        setCountdown(60) // 60秒倒计时
      } else {
        setMessage({ type: 'error', text: data.message || '发送失败，请稍后重试' })
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误，请稍后重试' })
    } finally {
      setIsSendingCode(false)
    }
  }

  // 登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    const isPhoneValid = validatePhone(phone)
    const isCodeValid = validateCode(code)

    if (!isPhoneValid || !isCodeValid) return

    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: '登录成功，正在跳转...' })
        // 存储token
        if (data.data?.accessToken) {
          localStorage.setItem('accessToken', data.data.accessToken)
          localStorage.setItem('refreshToken', data.data.refreshToken)
        }
        // 跳转到首页
        setTimeout(() => {
          router.push('/learn')
        }, 500)
      } else {
        setMessage({ type: 'error', text: data.message || '登录失败，请检查验证码' })
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误，请稍后重试' })
    } finally {
      setIsLoading(false)
    }
  }

  // 切换登录模式
  const switchMode = (mode: 'sms' | 'password') => {
    setLoginMode(mode)
    setMessage(null)
    // 清空两种模式的输入和错误
    setPhone('')
    setCode('')
    setPhoneError('')
    setCodeError('')
    setUsername('')
    setPassword('')
    setUsernameError('')
    setPasswordError('')
  }

  // 密码登录
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    let valid = true
    if (!username.trim()) {
      setUsernameError('请输入账号')
      valid = false
    } else {
      setUsernameError('')
    }
    if (!password) {
      setPasswordError('请输入密码')
      valid = false
    } else {
      setPasswordError('')
    }
    if (!valid) return

    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/v1/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: '登录成功，正在跳转...' })
        if (data.data?.accessToken) {
          localStorage.setItem('accessToken', data.data.accessToken)
          localStorage.setItem('refreshToken', data.data.refreshToken)
        }
        setTimeout(() => {
          router.push('/learn')
        }, 500)
      } else {
        setMessage({ type: 'error', text: data.message || '登录失败，账号或密码错误' })
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误，请稍后重试' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">登录字见</CardTitle>
        <CardDescription className="text-base mt-2">
          {loginMode === 'sms' ? '手机号验证码登录，新用户自动注册' : '使用账号密码登录'}
        </CardDescription>
        {/* 模式切换 */}
        <div className="flex mt-4 border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode('password')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              loginMode === 'password'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            账号密码
          </button>
          <button
            type="button"
            onClick={() => switchMode('sms')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              loginMode === 'sms'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            手机验证码
          </button>
        </div>
      </CardHeader>
      <form onSubmit={loginMode === 'sms' ? handleLogin : handlePasswordLogin}>
        <CardContent className="space-y-4">
          {loginMode === 'sms' ? (
            <>
              {/* 手机号输入 */}
              <div className="space-y-2">
                <Input
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (phoneError) validatePhone(e.target.value)
                  }}
                  error={phoneError}
                  maxLength={11}
                  disabled={isLoading}
                />
              </div>

              {/* 验证码输入 */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="请输入验证码"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      if (codeError) validateCode(e.target.value)
                    }}
                    error={codeError}
                    maxLength={6}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || isSendingCode || isLoading}
                  className="whitespace-nowrap min-w-[100px]"
                >
                  {isSendingCode ? (
                    '发送中...'
                  ) : countdown > 0 ? (
                    `${countdown}s`
                  ) : (
                    '获取验证码'
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* 账号输入 */}
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="请输入账号"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (usernameError) setUsernameError('')
                  }}
                  error={usernameError}
                  maxLength={50}
                  disabled={isLoading}
                />
              </div>
              {/* 密码输入 */}
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) setPasswordError('')
                  }}
                  error={passwordError}
                  maxLength={100}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {/* 提示信息 */}
          {message && (
            <div
              className={`text-sm p-3 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* 登录按钮 */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isLoading}
            disabled={isSendingCode}
          >
            登录
          </Button>
        </CardContent>
      </form>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        <span>还没有账号？</span>
        <Link href="/register" className="text-primary hover:underline ml-1">
          立即注册
        </Link>
      </CardFooter>
    </Card>
  )
}
