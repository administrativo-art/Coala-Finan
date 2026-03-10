
'use client';

import { NumericFormat, NumericFormatProps } from 'react-number-format';
import { Input } from '@/components/ui/input';
import { forwardRef } from 'react';

export const CurrencyInput = forwardRef<HTMLInputElement, Omit<NumericFormatProps, 'customInput'>>(
  (props, ref) => (
    <NumericFormat
      customInput={Input}
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={2}
      fixedDecimalScale
      prefix="R$ "
      getInputRef={ref}
      {...props}
    />
  )
);
CurrencyInput.displayName = 'CurrencyInput';
