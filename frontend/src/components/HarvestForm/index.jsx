import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wheat, Calendar, Weight, IndianRupee, User, Container, ShieldAlert, CheckCircle2 } from 'lucide-react';

import { Input } from '../Input';
import { Select } from '../Select';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { useTanks } from '../../context/TankContext';

// Zod Validation Schema matching backend contract (POST /api/harvests)
const harvestSchema = z.object({
  tankId: z
    .string()
    .min(1, 'Please select a Tank'),
  harvestDate: z
    .string()
    .min(1, 'Harvest Date is required'),
  harvestWeight: z
    .coerce
    .number({ invalid_type_error: 'Harvest Weight must be a number' })
    .positive('Harvest Weight must be greater than 0'),
  isFinalHarvest: z
    .boolean()
    .optional()
    .default(false),
  shrimpCount: z
    .coerce
    .number({ invalid_type_error: 'Shrimp Count must be a number' })
    .positive('Shrimp Count must be greater than 0')
    .optional()
    .nullable()
    .or(z.literal('')),
  sellingPrice: z
    .coerce
    .number({ invalid_type_error: 'Selling Price must be a number' })
    .positive('Selling Price must be greater than 0'),
  buyerName: z
    .string()
    .min(1, 'Buyer Name is required')
    .trim(),
  harvestExpense: z
    .coerce
    .number({ invalid_type_error: 'Harvest Expense must be a number' })
    .min(0, 'Harvest Expense cannot be negative'),
  notes: z
    .string()
    .optional(),
});

/**
 * Reusable HarvestForm component with dynamic Tank dropdown from TankContext.
 * Supports Register Harvest and Edit Harvest operations.
 * Displays error messages cleanly in a highlighted banner if registration/edit fails.
 */
export const HarvestForm = ({
  initialData = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const { tanks = [] } = useTanks();
  const isEditing = Boolean(initialData?.id);
  const [formError, setFormError] = useState('');

  // Clean tank labels without water source string
  const tankSelectOptions = tanks.map((tank) => {
    const rawName = tank.name || tank.tankName || 'Tank';
    const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
    const areaSuffix = tank.area ? ` (${tank.area} Acres)` : '';
    return {
      value: String(tank.id),
      label: `${cleanName}${areaSuffix}`,
    };
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(harvestSchema),
    defaultValues: {
      tankId: tankSelectOptions.length > 0 ? tankSelectOptions[0].value : '',
      harvestDate: new Date().toISOString().split('T')[0],
      harvestWeight: '',
      isFinalHarvest: false,
      shrimpCount: '',
      sellingPrice: '',
      buyerName: '',
      harvestExpense: '',
      notes: '',
    },
    mode: 'onTouched',
  });

  const isFinalVal = watch('isFinalHarvest');

  useEffect(() => {
    if (initialData) {
      reset({
        tankId: initialData.tankId ? String(initialData.tankId) : (tankSelectOptions[0]?.value || ''),
        harvestDate: initialData.harvestDate ? new Date(initialData.harvestDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        harvestWeight: initialData.harvestWeight || initialData.production || '',
        isFinalHarvest: initialData.harvestType === 'FINAL',
        shrimpCount: initialData.shrimpCount || '',
        sellingPrice: initialData.sellingPrice || '',
        buyerName: initialData.buyerName || '',
        harvestExpense: initialData.harvestExpense !== undefined && initialData.harvestExpense !== null ? String(initialData.harvestExpense) : '',
        notes: initialData.notes || '',
      });
    } else {
      reset({
        tankId: tankSelectOptions[0]?.value || '',
        harvestDate: new Date().toISOString().split('T')[0],
        harvestWeight: '',
        isFinalHarvest: false,
        shrimpCount: '',
        sellingPrice: '',
        buyerName: '',
        harvestExpense: '',
        notes: '',
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data) => {
    setFormError('');

    const selectedTankObj = tanks.find((t) => String(t.id) === String(data.tankId));
    const rawTankName = selectedTankObj ? (selectedTankObj.name || selectedTankObj.tankName) : 'Selected Tank';
    const cleanTankName = rawTankName.replace(/\s*\([^)]*\)/g, '').trim();

    const numericWeight = parseFloat(data.harvestWeight);
    const numericCount = data.shrimpCount ? parseFloat(data.shrimpCount) : null;

    const harvestPayload = {
      tankId: String(data.tankId),
      harvestDate: data.harvestDate,
      harvestWeight: numericWeight,
      harvestType: data.isFinalHarvest ? 'FINAL' : 'INTERMEDIATE',
      shrimpCount: numericCount,
      production: numericWeight,
      survivalRate: 85,
      sellingPrice: parseFloat(data.sellingPrice),
      buyerName: String(data.buyerName).trim(),
      transportationCost: null,
      harvestExpense: parseFloat(data.harvestExpense || 0),
      notes: data.notes ? String(data.notes).trim() : '',
      tankName: cleanTankName,
    };

    try {
      if (onSubmit) {
        await onSubmit(harvestPayload);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to save harvest record');
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5" noValidate>
      {formError && (
        <div className="p-3.5 rounded-xl bg-danger-light/30 border border-danger/30 flex items-center gap-2.5 text-danger text-xs font-medium">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* BASIC INFORMATION SECTION */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary border-b border-border/50 pb-1 flex items-center gap-1.5">
          <Container className="w-3.5 h-3.5 text-primary" /> Basic Information
        </h4>

        {/* Row 1: Tank & Harvest Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Tank"
            required={true}
            placeholder="Choose tank..."
            options={tankSelectOptions}
            error={errors.tankId?.message}
            disabled={isSubmitting}
            {...register('tankId')}
          />

          <Input
            label="Harvest Date"
            type="date"
            required={true}
            icon={<Calendar className="w-4 h-4 text-primary" />}
            error={errors.harvestDate?.message}
            disabled={isSubmitting}
            {...register('harvestDate')}
          />
        </div>

        {/* Buyer Name */}
        <Input
          label="Buyer Name"
          type="text"
          placeholder="Enter buyer name..."
          required={true}
          icon={<User className="w-4 h-4 text-primary" />}
          error={errors.buyerName?.message}
          disabled={isSubmitting}
          {...register('buyerName')}
        />

        {/* Selling Price (₹/kg) */}
        <Input
          label="Selling Price (₹/kg)"
          type="number"
          step="1"
          placeholder="Enter price per kg..."
          required={true}
          icon={<IndianRupee className="w-4 h-4 text-primary" />}
          error={errors.sellingPrice?.message}
          disabled={isSubmitting}
          {...register('sellingPrice')}
        />
      </div>

      {/* HARVEST DETAILS SECTION */}
      <div className="p-4 rounded-xl bg-primary-light/30 border border-primary/20 space-y-3 shadow-2xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Wheat className="w-3.5 h-3.5 text-primary" /> Harvest Yield & Type
        </h4>

        {/* Harvest Weight (kg) - Manually entered by user */}
        <Input
          label="Harvest Weight (kg)"
          type="number"
          step="0.1"
          placeholder="Enter total harvest weight in kg (e.g. 350)"
          required={true}
          icon={<Weight className="w-4 h-4 text-primary" />}
          error={errors.harvestWeight?.message}
          disabled={isSubmitting}
          {...register('harvestWeight')}
        />

        {/* Shrimp Count (Optional / Secondary metric) */}
        <Input
          label="Shrimp Count (Prawn Count)"
          type="number"
          step="1"
          placeholder="Enter estimated number of prawns harvested"
          required={false}
          icon={<Wheat className="w-4 h-4 text-primary" />}
          error={errors.shrimpCount?.message}
          disabled={isSubmitting}
          {...register('shrimpCount')}
        />

        {/* HARVEST TYPE OPTION (INTERMEDIATE vs FINAL) */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          isFinalVal ? 'bg-amber-500/10 border-amber-500/40' : 'bg-surface border-border/80'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary/30 cursor-pointer"
              disabled={isSubmitting}
              {...register('isFinalHarvest')}
            />
            <div>
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                Mark as Final Harvest
                {isFinalVal && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                    <CheckCircle2 className="w-3 h-3 text-amber-600" /> Final
                  </span>
                )}
              </span>
              <span className="text-[11px] text-text-secondary block mt-0.5">
                {isFinalVal
                  ? 'Saving this harvest as Final Harvest will complete the crop cycle and change crop status to COMPLETED.'
                  : 'Intermediate harvest. The crop status will remain ACTIVE for subsequent harvests.'}
              </span>
            </div>
          </label>
        </div>

        {/* Harvest Expense (₹) */}
        <Input
          label="Harvest Expense (₹)"
          type="number"
          step="1"
          placeholder="Enter harvest expense..."
          required={true}
          icon={<IndianRupee className="w-4 h-4 text-primary" />}
          error={errors.harvestExpense?.message}
          disabled={isSubmitting}
          className="no-spin [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
          {...register('harvestExpense')}
        />
      </div>

      {/* NOTES (OPTIONAL) */}
      <div>
        <Textarea
          label="Notes (Optional)"
          placeholder="Add buyer details, harvest quality, or remarks..."
          rows={2}
          error={errors.notes?.message}
          disabled={isSubmitting}
          {...register('notes')}
        />
      </div>

      {/* ACTIONS */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/80">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="font-semibold"
        >
          {isEditing ? (isSubmitting ? 'Updating...' : 'Update Harvest Record') : (isSubmitting ? 'Registering...' : 'Register Harvest')}
        </Button>
      </div>
    </form>
  );
};

export default HarvestForm;
