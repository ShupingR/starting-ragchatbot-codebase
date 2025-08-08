#!/bin/bash

# Frontend code quality check script

echo "🔍 Running frontend code quality checks..."
echo ""

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the frontend directory"
    exit 1
fi

# Function to print status
print_status() {
    if [ $? -eq 0 ]; then
        echo "✅ $1 passed"
    else
        echo "❌ $1 failed"
        return 1
    fi
}

# Run Prettier check
echo "📝 Checking code formatting with Prettier..."
npx prettier --check "*.js" "*.html" "*.css" > /dev/null 2>&1
print_status "Prettier format check"
PRETTIER_EXIT=$?

# Run ESLint
echo ""
echo "🔍 Running ESLint..."
npx eslint "*.js" --format=stylish
print_status "ESLint"
ESLINT_EXIT=$?

echo ""
if [ $PRETTIER_EXIT -eq 0 ] && [ $ESLINT_EXIT -eq 0 ]; then
    echo "🎉 All quality checks passed!"
    exit 0
else
    echo "💥 Some quality checks failed. Please fix the issues above."
    echo ""
    echo "💡 Quick fixes:"
    echo "   - Run 'npm run format' to auto-fix Prettier issues"
    echo "   - Run 'npm run lint:fix' to auto-fix ESLint issues"
    exit 1
fi