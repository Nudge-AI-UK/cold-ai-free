import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertCircle, Trash2, X } from 'lucide-react'
import { accountDeletionService } from '@/services/accountDeletionService'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [understand, setUnderstand] = useState(false)
  const [reason, setReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirmText !== 'DELETE' || !understand) {
      toast.error('Please confirm by typing DELETE and checking the box')
      return
    }

    setIsDeleting(true)

    try {
      const result = await accountDeletionService.requestDeletion(reason)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success('Account deletion initiated. You will be signed out.')

      // Sign out user
      await supabase.auth.signOut()

      // Redirect to login
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)

    } catch (error: any) {
      console.error('Delete account error:', error)
      toast.error(error.message || 'Failed to delete account')
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('')
      setUnderstand(false)
      setReason('')
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0C1725] border-2 border-red-500/50 max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              Delete Account
            </DialogTitle>
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Warning Banner */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-300 mb-2">Important: Permanent Deletion After 30 Days</p>
                <p className="text-xs text-gray-400 leading-relaxed mb-2">
                  Your account and all associated data will be permanently deleted after 30 days. This includes:
                </p>
                <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                  <li>All generated messages and prospects</li>
                  <li>Your ICPs and knowledge base entries</li>
                  <li>LinkedIn connection and integration data</li>
                  <li>Usage history and settings</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 30-Day Recovery Notice */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold text-sm">30</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-300 mb-1">30-Day Recovery Window</p>
                <p className="text-xs text-gray-400 leading-relaxed mb-2">
                  <strong className="text-blue-300">You can recover your account within 30 days</strong> by signing up again with the same email address. Your data will be immediately deleted, but:
                </p>
                <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                  <li>You can create a new account with the same email within 30 days</li>
                  <li>Your previous usage limits will be restored (not reset)</li>
                  <li>After 30 days, the deletion becomes permanent and cannot be recovered</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Reason (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Why are you leaving? (Optional)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isDeleting}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FBAE1C]/50 disabled:opacity-50"
            >
              <option value="">Select a reason...</option>
              <option value="found_alternative">Found an alternative</option>
              <option value="too_expensive">Too expensive</option>
              <option value="not_useful">Not useful for my needs</option>
              <option value="privacy_concerns">Privacy concerns</option>
              <option value="temporary_break">Taking a temporary break</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="understand"
              checked={understand}
              onChange={(e) => setUnderstand(e.target.checked)}
              disabled={isDeleting}
              className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-red-500 focus:ring-red-500 focus:ring-offset-0 disabled:opacity-50"
            />
            <label htmlFor="understand" className="text-sm text-gray-300 cursor-pointer">
              I understand that my data will be immediately deleted, but I can recover my account within 30 days by signing up with the same email. After 30 days, deletion becomes permanent.
            </label>
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type <span className="text-red-400 font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isDeleting}
              placeholder="DELETE"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 disabled:opacity-50"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== 'DELETE' || !understand}
              className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete My Account</span>
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
