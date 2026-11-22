import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

test('jest-dom matchers work with React elements in Vitest', () => {
  render(<button type="button" disabled>Mask</button>);
  const button = screen.getByRole('button', { name: 'Mask' });

  expect(button).toBeInTheDocument();
  expect(button).toHaveTextContent('Mask');
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('type', 'button');
});
