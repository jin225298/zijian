'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function RegisterPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
        setCountdown(60)
      } else {
        setMessage({ type: 'error', text: data.message || '发送失败，请稍后重试' })
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误，请稍后重试' })
    } finally {
      setIsSendingCode(false)
    }
  }

  // 注册（实际调用登录接口，新用户自动注册）
  const handleRegister = async (e: React.FormEvent) => {
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
        const isNewUser = data.data?.isNewUser
        setMessage({
          type: 'success',
          text: isNewUser ? '注册成功，正在跳转...' : '账号已存在，登录成功'
        })
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
        setMessage({ type: 'error', text: data.message || '注册失败，请稍后重试' })
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
        <CardTitle className="text-3xl font-bold">注册字见</CardTitle>
        <CardDescription className="text-base mt-2">
          AI驱动的聋哑人识字辅助系统
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
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

          {/* 注册按钮 */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isLoading}
            disabled={isSendingCode}
          >
            注册
          </Button>

          {/* 用户协议 */}
          <p className="text-xs text-muted-foreground text-center">
            注册即表示同意
            <Link href="/terms" className="text-primary hover:underline mx-1">
              用户协议
            </Link>
            和
            <Link href="/privacy" className="text-primary hover:underline mx-1">
              隐私政策
            </Link>
          </p>
        </CardContent>
      </form>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        <span>已有账号？</span>
        <Link href="/login" className="text-primary hover:underline ml-1">
          立即登录
        </Link>
      </CardFooter>
    </Card>
  )
}
