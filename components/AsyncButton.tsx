import { Button, ButtonProps } from "@shopify/polaris"
import { ReactNode, useState } from "react"

interface Props extends ButtonProps {
  onAsyncClick: any
}
const AsyncButton = (props: Props) => {
  const [isLoading, setIsLoading] = useState(false)
  async function handleClick() {
    setIsLoading(true)
    await props.onAsyncClick()
    setIsLoading(false)
  }
  return <Button {...props} onClick={handleClick} loading={isLoading} >{props.children}</Button>
}

export default AsyncButton